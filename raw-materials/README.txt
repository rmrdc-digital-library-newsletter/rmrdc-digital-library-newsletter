RMRDC Digital Library - Raw Materials Profiles with Logo Header + Admin Panel

WHAT IS INCLUDED
- index.html: Raw materials profile grid
- material.html: Mineral details page with animated value-chain tree
- admin.html: Admin panel to upload/add minerals
- minerals.js: Existing mineral database
- storage.js: Saves admin-uploaded minerals in browser localStorage
- app.js: Directory page logic
- material.js: Mineral details logic
- admin.js: Admin form and upload logic
- style.css: RMRDC green/gold theme and official-style header
- assets/rmrdc-logo.svg: Temporary placeholder logo

HOW TO ADD YOUR REAL RMRDC LOGO
1. Open the extracted project folder.
2. Open the assets folder.
3. Copy your real logo image into the assets folder.
4. Rename the logo file to:
   rmrdc-logo.png
5. Refresh the website.

HOW TO RUN
1. Extract this ZIP file.
2. Open index.html in your browser.
3. Click Admin Panel in the top menu.
4. Fill the form and upload a cover image.
5. Click Save Mineral.
6. Return to Raw Materials page to see the new mineral.

IMPORTANT NOTE ABOUT ADMIN UPLOADS
This admin panel saves uploaded minerals in your browser using localStorage.
That means:
- It works immediately without Supabase.
- It is good for demo/testing.
- The data stays only in the same browser.
- For a real online website, connect it to Supabase later.

NEXT STEP FOR REAL ONLINE ADMIN
To make uploaded minerals visible to everyone, connect admin.html to Supabase database and Supabase storage.


TWO RAW MATERIAL TYPES ADDED
1. Mineral Raw Material Profiles
2. Agro Raw Materials Profiles

HOW IT WORKS
- The homepage now has category cards for All, Mineral, and Agro.
- Each material in minerals.js has a category field:
  category: "mineral"
  or
  category: "agro"
- Admin panel also has a dropdown to choose the raw material type.

EXAMPLES ADDED
Agro examples added:
- Cassava
- Shea Nut
- Oil Palm
- Cotton


FIXED SAMPLE DATA
This version contains visible sample cards immediately:
Mineral samples:
- Bentonite
- Limestone
- Kaolin
- Barite
- Gypsum
- Iron Ore
- Silica Sand

Agro samples:
- Cassava
- Shea Nut
- Oil Palm
- Cotton
- Ginger
- Cocoa


LATEST CHANGES
- Removed the general "Raw Materials Profiles" category.
- Homepage now keeps only:
  1. Mineral Raw Material Profiles
  2. Agro Raw Materials Profiles
- Details page and admin page now use the same green/gold header layout as homepage.
- 30% Value Addition Opportunities stage is now light green.
- Clicking the 30% stage displays the relevant pilot plant name and image in the middle of the value-chain section.
- Admin panel now includes pilot plant name and pilot plant image upload fields.


LOCAL IMAGE UPLOAD SYSTEM ADDED
- Sample images are still kept as external links.
- Admin panel now includes a Local Image Library.
- You can upload images from your PC into the browser library.
- You can select any uploaded image and use it as:
  1. Cover image
  2. Pilot plant image
- This works without Supabase and is stored in browser localStorage.

IMPORTANT
This is a local/demo upload system. Images remain in the same browser.
For real online deployment where everyone can see uploaded images, connect it to Supabase Storage later.
