import {
  MaxFileSizeExceededError,
  MaxFilesExceededError,
  MaxHeaderSizeExceededError,
  MaxPartsExceededError,
  MaxTotalSizeExceededError,
  type ParseFormDataOptions,
  parseFormData,
} from 'remix/form-data-parser'
import { redirect } from 'remix/response/redirect'
import type { Middleware, RequestContext } from 'remix/router'

import { routes } from '../routes.ts'
import { CurrentUserKey } from './current-user.ts'

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
  maxHeaderSize: 1024,
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
    // The media type alone, as Remix's own form-data middleware compares it.
    const mediaType = (context.headers.get('Content-Type') ?? '')
      .split(';')[0]
      ?.trim()
      .toLowerCase()
    const isForm =
      mediaType?.startsWith('multipart/') || mediaType === 'application/x-www-form-urlencoded'
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
      // Anything else the parser throws is about the body sent (bad framing, invalid UTF-8 in a
      // field or a part header…): the client's fault, never a server error.
      return new Response('Formulaire illisible.', {
        status: 400,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      })
    }
    context.set(FormData, parsed, { property: 'formData' })
    return next()
  }
}

/** The one file an import accepts (ADR 0026): 2 MB, a few fields beside it. */
export const importUploadLimits = {
  maxFiles: 1,
  maxFileSize: 2 * 1024 * 1024,
  maxTotalSize: 2 * 1024 * 1024 + 64 * 1024,
  maxParts: 8,
  maxHeaderSize: 1024,
} satisfies ParseFormDataOptions

/**
 * The upload allowance: the import's first step, for an active account only (visitors and pending
 * accounts never reach a 2 MB body). A refusal lands back on the step with its explanation.
 */
export function importUpload(context: RequestContext): UploadAllowance | null {
  const user = context.get(CurrentUserKey)
  if (context.method !== 'POST' || user?.status !== 'active') return null
  if (context.url.pathname !== routes.imports.start.action.href()) return null
  return {
    limits: importUploadLimits,
    tooLargeRedirect: `${routes.imports.start.index.href()}?erreur=taille`,
  }
}
