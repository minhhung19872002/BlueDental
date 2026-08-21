# Production Data Handling

Do not copy real patient data from the reference system into the codebase.

Do not commit:

- patient names
- phone numbers
- addresses
- medical history
- appointment details associated with identifiable patients
- authentication tokens
- cookies
- Authorization headers
- production API tokens

When documenting APIs, keep only structure.

Example:

BAD:

{
  "name": "Nguyen Van A",
  "phone": "090..."
}

GOOD:

{
  "name": "<string>",
  "phone": "<string>"
}

Use synthetic data in the local application.

Screenshots or network captures containing production data must remain
inside reference-private/ and must never be committed.