import webview
import os
import sys
import json
import base64
import urllib.request
import urllib.error

def get_current_dir():
    # Quando transformado em .exe com PyInstaller, os arquivos são extraídos num diretório temporário
    if hasattr(sys, '_MEIPASS'):
        return sys._MEIPASS
    return os.path.dirname(os.path.abspath(__file__))

class Api:
    def __init__(self):
        self._window = None

    def set_window(self, window):
        self._window = window

    def save_image_dialog(self, base64_data, default_filename):
        """Abre a janela do Windows para salvar a imagem"""
        try:
            # O base64 vem como "data:image/png;base64,iVBORw0KGgo..."
            header, encoded = base64_data.split(",", 1)
            file_data = base64.b64decode(encoded)

            save_path = self._window.create_file_dialog(
                webview.FileDialog.SAVE, 
                directory='', 
                save_filename=default_filename,
                file_types=('PNG Image (*.png)', 'All files (*.*)')
            )

            if save_path:
                if isinstance(save_path, tuple) or isinstance(save_path, list):
                    path = save_path[0]
                else:
                    path = save_path
                
                with open(path, 'wb') as f:
                    f.write(file_data)
                return True
            return False
        except Exception as e:
            print(f"Erro ao salvar imagem: {e}")
            return False

    def export_backup_dialog(self, json_string, default_filename):
        """Abre a janela do Windows para salvar o JSON de backup"""
        try:
            save_path = self._window.create_file_dialog(
                webview.FileDialog.SAVE, 
                directory='', 
                save_filename=default_filename,
                file_types=('JSON Files (*.json)', 'All files (*.*)')
            )

            if save_path:
                if isinstance(save_path, tuple) or isinstance(save_path, list):
                    path = save_path[0]
                else:
                    path = save_path
                
                with open(path, 'w', encoding='utf-8') as f:
                    f.write(json_string)
                return True
            return False
        except Exception as e:
            print(f"Erro ao exportar backup: {e}")
            return False

    def import_backup_dialog(self):
        """Abre a janela do Windows para ler o JSON de backup e retorna pro JS"""
        try:
            file_path = self._window.create_file_dialog(
                webview.FileDialog.OPEN, 
                allow_multiple=False,
                file_types=('JSON Files (*.json)', 'All files (*.*)')
            )

            if file_path:
                if isinstance(file_path, tuple) or isinstance(file_path, list):
                    path = file_path[0]
                else:
                    path = file_path
                
                with open(path, 'r', encoding='utf-8') as f:
                    return f.read()
            return None
        except Exception as e:
            print(f"Erro ao importar backup: {e}")
            return None

    def publish_to_github(self, html_content, date_str):
        """Publica um arquivo HTML estático no GitHub Pages para a data informada"""
        # Try to read token from local file
        token_file = os.path.join(get_current_dir(), '.ghtoken')
        token = ""
        if os.path.exists(token_file):
            with open(token_file, 'r', encoding='utf-8') as f:
                token = f.read().strip()
                
        repo = "WorkstationNeural/GestaoEscalasDesktop"
        branch = "gh-pages"
        file_path = f"diarias/{date_str}/index.html"
        url = f"https://api.github.com/repos/{repo}/contents/{file_path}"
        
        headers = {
            "Authorization": f"token {token}",
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "PyWebView-App"
        }
        
        # 1. Verifica se o branch existe, se não, não conseguiremos criar pelo endpoint de contents facilmente sem um commit base, 
        # mas como é gh-pages, a abordagem ideal pra garantir é usar a API de forma segura.
        # Primeiro, tentar dar GET no arquivo pra pegar o SHA se ele já existir (para atualizar).
        sha = None
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req) as response:
                res_data = json.loads(response.read().decode())
                sha = res_data.get('sha')
        except urllib.error.HTTPError as e:
            if e.code != 404:
                return {"error": f"Erro ao acessar GitHub API: {e.code}"}
        except Exception as e:
            return {"error": str(e)}

        # 2. Prepara o payload para criar/atualizar o arquivo no branch gh-pages
        content_b64 = base64.b64encode(html_content.encode('utf-8')).decode('utf-8')
        payload = {
            "message": f"Publicando escala do dia {date_str}",
            "content": content_b64,
            "branch": branch
        }
        if sha:
            payload["sha"] = sha
            
        data = json.dumps(payload).encode('utf-8')
        
        try:
            req = urllib.request.Request(url, data=data, headers=headers, method='PUT')
            with urllib.request.urlopen(req) as response:
                result = json.loads(response.read().decode())
                
            # Retorna URL pública baseada no formato do Github Pages
            public_url = f"https://WorkstationNeural.github.io/GestaoEscalasDesktop/{file_path}"
            return {"url": public_url}
            
        except urllib.error.HTTPError as e:
            err_msg = e.read().decode()
            print("Erro no upload:", err_msg)
            return {"error": f"Falha ao enviar ao GitHub: {err_msg}"}
        except Exception as e:
            return {"error": str(e)}

if __name__ == '__main__':
    html_path = os.path.join(get_current_dir(), 'index.html')
    
    api = Api()
    
    window = webview.create_window(
        'Gestão de Escalas', 
        url=html_path, 
        js_api=api,
        width=1200, 
        height=800,
        min_size=(900, 600)
    )
    
    api.set_window(window)
    
    webview.start()
