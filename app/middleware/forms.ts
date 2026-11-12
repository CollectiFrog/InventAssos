import {
  FormDataParseError,
  MaxFileSizeExceededError,
  MaxFilesExceededError,
  MaxHeaderSizeExceededError,
  MaxPartsExceededError,
  MaxTotalSizeExceededError,
  MultipartParseError,
  type ParseFormDataOptions,
  parseFormData,
} from 'remix/form-data-parser'
import { redirect } from 'remix/response/redirect'
import type { Middleware, RequestContext } from 'remix/router'

/** True when the body passed one of the parser's limits. */
function isLimitError(error: unknown): boolean {
  return (
    error instanceof MaxFilesExceededError ||
    error instanceof MaxFileSizeExceededError ||
    error instanceof MaxHeaderSizeExceededError ||
    error instanceof MaxPartsExceededError ||
    error instanceof MaxTotalSizeExceededError
  )
}

/**
 * What any form may send: no file, small fields. The parser's own defaults (20 files of 2 MiB,
 * 41 MiB in all) let anyone make a pod buffer far more than it holds, before CSRF is checked.
 */
export const defaultFormLimits = {
  maxFiles: 0,
  maxFileSize: 64 * 1024,
  maxTotalSize: 256 * 1024,
  maxParts: 400,
} satisfies ParseFormDataOptions

/** A route allowed a file, with its limits and the page that explains a refusal. */
export interface UploadAllowance {
  limits: ParseFormDataOptions & { maxTotalSize: number }
  /** Where a too-large upload is sent, so the person reads why instead of an error page. */
  tooLargeRedirect: string
}

/** Answer to a body over the limits: a page that explains it, or a plain 413. */
function refuse(upload: UploadAllowance | null): Response {
  if (upload) return redirect(upload.tooLargeRedirect, 303)
  return new Response('Formulaire trop volumineux.', {
    status: 413,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}

/**
 * Parses form posts within limits (security review of ADR 0026). `uploadFor` names the few routes
 * allowed a file; every other request gets `defaultFormLimits`. A body over its limits is refused
 * before it is read when `Content-Length` says so, else as soon as the stream passes the limit;
 * a malformed body answers 400 instead of a server error.
 */
export function boundedFormData(
  uploadFor: (context: RequestContext) => UploadAllowance | null = () => null,
): Middleware<{ key: typeof FormData; value: FormData; property: 'formData' }> {
  return async (context, next) => {
    const contentType = context.headers.get('Content-Type')?.toLowerCase() ?? ''
    const isForm =
      contentType.startsWith('multipart/') ||
      contentType.startsWith('application/x-www-form-urlencoded')
    if (context.method === 'GET' || context.method === 'HEAD' || !isForm) {
      context.set(FormData, new FormData(), { property: 'formData' })
      return next()
    }

    const upload = uploadFor(context)
    const limits = upload?.limits ?? defaultFormLimits
    const declared = Number(context.headers.get('Content-Length') ?? Number.NaN)
    if (Number.isFinite(declared) && declared > limits.maxTotalSize) return refuse(upload)

    let parsed: FormData
    try {
      parsed = await parseFormData(context.request, limits)
    } catch (error) {
      if (isLimitError(error)) return refuse(upload)
      if (error instanceof FormDataParseError || error instanceof MultipartParseError) {
        return new Response('Formulaire illisible.', {
          status: 400,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        })
      }
      throw error
    }
    context.set(FormData, parsed, { property: 'formData' })
    return next()
  }
}
