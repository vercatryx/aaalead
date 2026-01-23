# Page 6 Fields - How They Are Filled

## Fields on Page 6 (3rd-to-last page with new form fields):

1. **address** (lowercase)
   - Source: Static (auto-filled)
   - How: Copied from "Inspection Location" field (same as Address field)
   - Code location: pdfGenerator.ts line ~1468

2. **county**
   - Source: User Input
   - How: User enters in form field #2 "county"
   - Code location: Main loop processes user_input fields

3. **block**
   - Source: User Input
   - How: User enters in form field #3 "block"
   - Code location: Main loop processes user_input fields

4. **lot**
   - Source: User Input
   - How: User enters in form field #4 "lot"
   - Code location: Main loop processes user_input fields

5. **Units areas**
   - Source: User Input
   - How: User enters in form field #5 "Units areas"
   - Code location: Main loop processes user_input fields

6. **Inspector name**
   - Source: User Input
   - How: User enters in form field #12 "Inspector name" OR auto-filled from inspector dropdown
   - Code location: Main loop (user_input) + special section fills from dropdown if selected

7. **inpector name** (typo - has trailing space)
   - Source: Static (auto-filled)
   - How: Copied from "Inspector name" field
   - Code location: pdfGenerator.ts line ~1495

8. **contractor name** (has trailing space)
   - Source: Static
   - Value: "AAA Lead Professionals"
   - Code location: Main loop processes static fields

9. **contactor address** (typo - "contactor" instead of "contractor")
   - Source: Static
   - Value: "6 White Dove Court, Lakewood, NJ, 08701"
   - Code location: Main loop processes static fields

10. **njdoh**
    - Source: User Input
    - How: User enters in form field #16 "njdoh"
    - Code location: Main loop processes user_input fields

11. **njdca**
    - Source: User Input
    - How: User enters in form field #17 "njdca"
    - Code location: Main loop processes user_input fields

12. **phone**
    - Source: User Input
    - How: User enters in form field #18 "phone"
    - Code location: Main loop processes user_input fields

13. **insp date**
    - Source: Static (auto-filled)
    - How: Copied from "Date" field (inspection date) after Date is filled
    - Code location: pdfGenerator.ts line ~1663

14. **insp date end**
    - Source: Static (auto-filled)
    - How: Copied from "Date" field (inspection date) after Date is filled
    - Code location: pdfGenerator.ts line ~1664

15. **cert date**
    - Source: Static (auto-filled)
    - How: Copied from "Date" field (inspection date) after Date is filled
    - Code location: pdfGenerator.ts line ~1665

## Summary:
- **User Input Fields (8)**: county, block, lot, Units areas, Inspector name, njdoh, njdca, phone
- **Auto-filled from Inspection Location (1)**: address
- **Auto-filled from Inspector name (1)**: inpector name
- **Auto-filled from Date (3)**: insp date, insp date end, cert date
- **Static Values (2)**: contractor name, contactor address
