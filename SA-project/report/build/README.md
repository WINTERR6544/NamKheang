# Report build scripts (chapters 6–8)

Screenshots are read from `../screenshots/`. Needs Node with the `docx` package.

    npm i docx
    node build.js ../บทที่6_Software_Development_Platform.docx
    node ch7.js   ../บทที่7_User_Interface.docx
    node ch8.js   ../บทที่8_การทดสอบระบบ.docx
    python3 nocompress.py ../บทที่7_User_Interface.docx   # keep Word from compressing pictures
    python3 nocompress.py ../บทที่8_การทดสอบระบบ.docx

- `ui.dot` → `../screenshots/ui_structure.png`: `dot -Tpng -Gdpi=200 ui.dot -o ../screenshots/ui_structure.png`
- `q.json` = Query Table from chapter 4 (used by 8.2)
- `zs.py` stitches 1568x772 browser captures of a 1277x718 viewport into 1564-wide screenshots
