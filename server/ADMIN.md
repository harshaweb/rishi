# Omshivraj administrator

Sign in at https://rishi-server-three.vercel.app/login and open https://rishi-server-three.vercel.app/admin. An active account with the `ADMIN` role is required; signup never grants administrator access.

## Daily operations

- **Properties → Add flat:** create a draft, supply accurate details, prices, address, amenities and photos, then approve it through Properties → Details / actions. Editing a published flat returns it to draft for review.
- **Properties → Manage availability:** select a flat (title and city), block dates or remove a block. The end date is checkout and is exclusive. Administrators can manage all hosts' flats; hosts see only their own. Existing reservation nights cannot be blocked.
- **Reservations → Details / actions:** confirm a pending host-approval request or cancel an eligible reservation. Confirming reserves the dates and records payment as due at the property; it does not mark an unpaid stay as paid. Expired or cancelled requests cannot be revived. Cancellations release inventory and calculate eligible refunds.
- **Guests & users:** manage account roles and active status. Administrators cannot disable or demote their own account.
- **Hosts:** approve or reject hosting applications. Rejecting a host removes their listings from publication.
- **Reviews / Support reports:** moderate reviews and resolve or dismiss reports.
- **Categories / Coupons:** create categories and promotions; enable or disable them as needed.
- **Settings:** save platform-fee basis points, tax basis points and the announcement. 500 basis points means 5%.
- **Payments / Refunds:** inspect provider records and process eligible pending refunds. Real Razorpay processing requires configured live credentials; admin controls do not simulate successful payments.
- **Activity log:** review recorded administrative actions, including reservation confirmations.

Search and pagination apply to the current section. Export downloads the current page, not the entire database. Refresh reloads database records.

Provider configuration and verification instructions are in [SERVICES.md](SERVICES.md). Keep passwords and API secrets out of Git, chat and frontend variables.
