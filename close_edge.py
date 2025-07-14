import os
import sys
import time
import psutil
import subprocess

def close_edge():
    # Cerrar todos los procesos de Edge
    for proc in psutil.process_iter(['name']):
        try:
            if 'msedge' in proc.info['name'].lower():
                proc.kill()
        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
            pass
    
    # Esperar un momento para asegurar que Edge se cerró completamente
    time.sleep(2)

if __name__ == "__main__":
    close_edge() 