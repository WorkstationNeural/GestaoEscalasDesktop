import webview
import os
import sys
import json
import base64

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
