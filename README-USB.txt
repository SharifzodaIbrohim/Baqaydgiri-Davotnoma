БАҚАЙДГИРӢ · ДАЪВАТНОМА — насб ба компютери дигар (USB)

1) Дар компютери ҳозира
   - Папкаи лоиҳаро (Baqaydgiri-Davotnoma) ба USB нусха кунед.
   - Метавонед нагиред: .venv , __pycache__
   - Гиред: server.py, db.py, config.py, requirements.txt, .env.example,
     templates, static, utils, start.bat, stop.bat, patch_scan.py
   - Агар маълумот лозим: data\app.db ва data\photos\

2) Дар компютери нав
   a) Python 3.10+ насб: https://www.python.org/downloads/
      МУҲИМ: "Add python.exe to PATH" фаъол бошад.
   b) Папкаро аз USB ба диск: C:\Baqaydgiri-Davotnoma
   c) Ду бор клик: start.bat
      - аввал интернет (pip)
      - баъд офлайн
      - браузер: http://127.0.0.1:5000

3) Логин — файли .env (ADMIN_USER / ADMIN_PASS)

4) Shortcut: start.bat → Send to → Desktop

5) Қать: равзанаро пӯшед ё stop.bat

6) Мушкилот
   - Python not found → PATH + restart
   - Камера → Chrome/Edge + localhost
   - /api/scan нест → start.bat худаш patch_scan.py мезанад
