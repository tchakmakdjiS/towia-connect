<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Payment beneficiary is derived in the database from missions.company_id (trigger on payments/invoices): company if set, else the operator — never trust client/webhook input for it.
- Team operator accounts are created via server-side Auth invite; company linkage is set by the server, and operators can never change their own company_id/user_id (DB trigger).
