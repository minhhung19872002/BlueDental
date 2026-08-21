# Reference Production System — STRICT READ ONLY

Reference application:

https://app.nfcdental.com

The reference application is a production system.

## Highest priority rule

The reference application MUST NEVER be modified.

This requirement has higher priority than:

- cloning accuracy
- application discovery
- visual parity
- functional parity
- testing
- completing a task

## Forbidden production actions

Never:

- create records
- edit records
- update records
- delete records
- save forms
- submit business forms
- approve
- reject
- cancel business records
- change status
- assign users
- upload files
- import files
- send messages
- send notifications
- create appointments
- edit appointments
- create patients
- edit patients
- create receptions
- edit receptions
- change configuration
- change permissions

Never intentionally issue mutating production requests:

- POST
- PUT
- PATCH
- DELETE

Do not replay requests captured from production.

Do not use curl, fetch, axios, Playwright evaluate,
browser_run_code, DevTools, or another mechanism to bypass
these restrictions.

## Unknown interactions

Unknown actions are unsafe by default.

If there is any reasonable possibility that clicking a control
can modify persistent state, DO NOT click it.

Record it in:

docs/clone/unknowns.md

using:

UNKNOWN_REFERENCE_BEHAVIOR

Page:
Control:
Reason:
Action taken: NONE

## Safe observation

Allowed when read-only:

- inspect existing pages
- inspect existing records
- accessibility snapshots
- screenshots
- DOM structure
- visible text
- visible labels
- CSS/layout
- existing network traffic
- existing API responses
- route discovery
- static assets
- console messages

## Forms

Do not type into production forms.

Do not test validation by submitting production forms.

Form behavior that cannot be safely observed must be marked unknown.

## Local clone

These restrictions ONLY apply to the reference production system.

The local BlueDental project may be freely:

- created
- edited
- deleted
- tested
- seeded with fake data
- submitted
- automated

## Fundamental rule

REFERENCE = READ ONLY

LOCAL CLONE = FULL CONTROL

When safety and clone accuracy conflict, choose safety.