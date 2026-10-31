# CSE Course File Hub

A static, database-free course file management portal for CSE and related programmes.

## Included modules
- Course Register: course identity, programme, semester, session, LTPC and faculty details
- OBE Curriculum: university/school/department vision and mission, graduate attributes, PEOs, POs, PSOs, KSA and academic calendar
- Course Design: objectives, COs and targets, CO-PO/PSO and CO-KSA mapping, SDG/ethics/skills, syllabus, references, MOOCs, lesson plan, theory/lab assessment plans and experiments
- Teaching & Learning: faculty allocation, timetable, notes, assignments, solutions, examination papers, rubrics, ePortfolio and attendance
- Assessment & Attainment: continuous assessment, rubric records, CO attainment, learner classification, remedial action, feedback, meeting minutes and next-cycle action plan
- Appendices and evidence attachments
- Print / Save PDF, JSON backup export and import

## Deploy without a database
### GitHub Pages
1. Open repository **Settings → Pages**.
2. Under **Build and deployment**, choose **Deploy from a branch**.
3. Select branch **main** and folder **/(root)**, then Save.
4. Wait for GitHub Pages to publish the site. The URL will appear in the Pages section.

### Netlify
Import this GitHub repository into Netlify. It is a static site: no build command and no publish directory other than the repository root are required.

## Storage behaviour
Course data is stored in browser Local Storage. Attachments are stored in browser IndexedDB. No data is sent to a server. Each browser/device has its own local data. Use **Export Backup** regularly and import the backup on another browser/device when required. Clearing browser data can erase locally stored records.

## Current scope / limitations
This is an individual/local course-file workspace. It does not currently include institutional login, role permissions, HOD central collection, approval workflows, ERP integration, automatic extraction from Word/PDF, or automatic CO attainment calculations. Learner thresholds and attainment rules should be entered according to the applicable approved university policy; they are not hard-coded.
