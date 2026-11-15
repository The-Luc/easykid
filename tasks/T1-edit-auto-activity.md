# T1: Allow editing auto-generated activity records

**Status:** todo

## Requirements
1. Auto activity records (the ones calculated from eat/sleep) can be edited.
2. If the user changes the start time or end time, the record converts to a manual record.
3. The user can add a comment to an auto record.
   - Adding or editing a comment only does not convert it to a manual record.
   - The record stays auto and keeps recalculating.

## Open questions (for pickup)
- Once converted to manual, should it stop recalculating when the eat/sleep records change? (Assumed yes.)
- Can a converted record be turned back into auto?
- Does the comment need to sync to Supabase (a new column or migration)?
