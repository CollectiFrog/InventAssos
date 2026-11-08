# State of the art: shared equipment inventories

Origin: research done on 2026-11-05 and 2026-11-06. Full study (French, private link):
<https://claude.ai/artifact/4sh7m1qMoqww4em3ZF3E6t>. Prices and status may have changed since.

## Conclusion

No ready-made tool combines stage equipment, sharing between independent associations and a
French interface. Two free tools implement the "each holds its stock, shared catalogue, holder
approves" model: **leihs** (GPL-3.0, Zurich University of the Arts, inventory pools) and the
**Matosthèque** (Grenoble, but proprietary licence, see `matostheque-audit.md`). We build our own,
inspired by both.

## Tools reviewed

| Family                       | Tools                                                                                                                       | Takeaway                                                                                        |
|------------------------------|-----------------------------------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------|
| Event rental SaaS            | Rentman, HireHop, Current RMS, Booqable                                                                                     | good stage features (kits, quantities, barcodes); paid, single company, closed                  |
| Open-source asset management | Shelf (AGPL), Snipe-IT (AGPL), InvenTree (MIT), Homebox (AGPL), Dolibarr (GPL)                                              | Shelf closest to "book equipment"; Snipe-IT has multi-company; none has cross-org loan approval |
| Library of things            | leihs (GPL-3.0), CommonsBooking (GPL-2.0), Lend Engine, myTurn                                                              | leihs = our model (pools + approval), heavy Ruby stack                                          |
| French pooling initiatives   | Matosthèque, DAMME (Grenoble), La Caverne (Rennes), Ressourcerie culturelle, Ressourcerie du Spectacle (Dolibarr), Entrasso | mostly central stocks; Matosthèque the only tool-backed shared model                            |

Feature ideas kept: kits, quantities for cables, QR codes, holder approval, audit trail, reminders.
Lesson kept from the Matosthèque: the hardest part is the initial inventory, hence import (V0.8).
