@echo off
echo  Démarrage des microservices Python...

start "Text Extractor" cmd /k "cd text_extractor && python main.py"
timeout /t 2
start "Text Splitter" cmd /k "cd text_splitter && python main.py"
timeout /t 2
start "Embeddings" cmd /k "cd embeddings && python main.py"
timeout /t 2
start "Retriever" cmd /k "cd retrievers && python main.py"
timeout /t 2
start "Reranker" cmd /k "cd reranks && python main.py"

echo Tous les services démarrés !
echo.
echo Services disponibles :
echo   Text Extractor : http://localhost:6000
echo   Text Splitter  : http://localhost:6001
echo   Embeddings     : http://localhost:6002
echo   Retriever      : http://localhost:6003
echo   Reranker       : http://localhost:6004