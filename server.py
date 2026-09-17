# -*- coding: utf-8 -*-
import os
import time
import json
import uuid
import base64
import secrets
import hashlib
import sqlite3
from typing import Optional, Dict, Any, List
from datetime import datetime
from fastapi import FastAPI, Request, HTTPException, Depends, Header, Response, Cookie, UploadFile, File
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import uvicorn

import socket

DB_FILE = 'utong_factory.db'
UPLOAD_DIR = 'static/uploads'
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs('static', exist_ok=True)

def get_local_ip() -> str:
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode('utf-8')).hexdigest()

def get_db():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

def log_action(user_id: str, username: str, action: str, detail: str = '', ip_address: str = ''):
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO system_logs (user_id, username, action, detail, ip_address)
            VALUES (?, ?, ?, ?, ?);
        """, (user_id, username, action, detail, ip_address))
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Log error: {e}")

def init_db():
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS departments (
        id TEXT PRIMARY KEY,
        code TEXT NOT NULL,
        name_ru TEXT NOT NULL,
        name_uz TEXT NOT NULL,
        head_name TEXT NOT NULL,
        head_role TEXT NOT NULL,
        description_ru TEXT,
        description_uz TEXT,
        compliance_score REAL DEFAULT 95.0,
        status TEXT DEFAULT 'Активен'
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        full_name TEXT NOT NULL,
        role TEXT NOT NULL,
        department_id TEXT NOT NULL,
        assigned_lines TEXT DEFAULT '',
        is_active INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    cursor.execute("PRAGMA table_info(users);")
    user_cols = [row[1] for row in cursor.fetchall()]
    if 'assigned_lines' not in user_cols:
        cursor.execute("ALTER TABLE users ADD COLUMN assigned_lines TEXT DEFAULT '';")
    if 'is_active' not in user_cols:
        cursor.execute("ALTER TABLE users ADD COLUMN is_active INTEGER DEFAULT 1;")

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS assembly_lines (
        id TEXT PRIMARY KEY,
        department_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        is_active INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(department_id) REFERENCES departments(id)
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS invite_keys (
        id TEXT PRIMARY KEY,
        key_code TEXT UNIQUE NOT NULL,
        role TEXT NOT NULL,
        department_id TEXT NOT NULL,
        created_by TEXT NOT NULL,
        max_uses INTEGER DEFAULT 10,
        used_count INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        note TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS line_issues (
        id TEXT PRIMARY KEY,
        ticket_number TEXT UNIQUE NOT NULL,
        department_id TEXT NOT NULL,
        line_name TEXT NOT NULL,
        defect_type TEXT NOT NULL,
        severity TEXT NOT NULL,
        description TEXT NOT NULL,
        status TEXT NOT NULL,
        initial_photo_url TEXT,
        assigned_to TEXT,
        action_taken TEXT,
        verification_photo_url TEXT,
        created_by_user TEXT NOT NULL,
        reporter_name TEXT,
        downtime_minutes INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        assigned_at TIMESTAMP,
        resolved_at TIMESTAMP,
        closed_at TIMESTAMP,
        FOREIGN KEY(department_id) REFERENCES departments(id)
    );
    """)

    cursor.execute("PRAGMA table_info(line_issues);")
    issue_cols = [row[1] for row in cursor.fetchall()]
    if 'reporter_name' not in issue_cols:
        cursor.execute("ALTER TABLE line_issues ADD COLUMN reporter_name TEXT;")
    if 'downtime_minutes' not in issue_cols:
        cursor.execute("ALTER TABLE line_issues ADD COLUMN downtime_minutes INTEGER DEFAULT 0;")

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS biqs_audits (
        id TEXT PRIMARY KEY,
        auditor_name TEXT NOT NULL,
        department_id TEXT NOT NULL,
        line_name TEXT NOT NULL,
        compliance_score REAL NOT NULL,
        worker_name TEXT NOT NULL,
        worker_knowledge_status TEXT NOT NULL,
        questions_json TEXT NOT NULL,
        violation_photos_json TEXT,
        comments TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(department_id) REFERENCES departments(id)
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS cobalt_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        assembly_pace INTEGER NOT NULL,
        target_pace INTEGER NOT NULL,
        status TEXT NOT NULL
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS system_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT,
        username TEXT,
        action TEXT NOT NULL,
        detail TEXT,
        ip_address TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    cursor.execute("SELECT COUNT(*) FROM departments;")
    if cursor.fetchone()[0] == 0:
        departments_data = [
            ('ws-assembly', 'WS-01', 'Сборочный цех автомобильных сидений', 'Avtomobil oʻrindiqlarini yigʻish sexi', 'Азизов Карим', 'Начальник сборочного производства', 'Главный конвейер сборки автокресел Cobalt, Tracker, Onix. Контроль геометрии и момента затяжки.', 'Cobalt, Tracker, Onix oʻrindiqlarini yigʻish bosh konveyeri. Geometriya va tortish momenti nazorati.', 96.8, 'В норме'),
            ('ws-welding', 'WS-02', 'Цех металлокаркасов и роботизированной сварки', 'Metall karkaslar va payvandlash sexi', 'Рахимов Шерзод', 'Главный сварщик завода', 'Автоматические сварочные комплексы, проверка прочности сварных швов и штампованных элементов.', 'Avtomatik payvandlash majmualari, payvand choklari va shtamplangan detallar mustahkamligi nazorati.', 94.2, 'Высокий стандарт'),
            ('ws-foam', 'WS-03', 'Цех пенополиуретана (ППУ / Вспенивание)', 'Penopoliuretan (PPU / Koʻpirtirish) sexi', 'Юсупов Джамшид', 'Технолог полиуретановых систем', 'Формование подушек и спинок сидений, контроль плотности пены, упругости и отсутствие пустот.', 'Oʻrindiq yostiqlari va suyanish qismlarini shakllantirish, koʻpik zichligi va elastikligi nazorati.', 98.1, 'В норме'),
            ('ws-sewing', 'WS-04', 'Цех раскроя и пошива чехлов', 'Bichish va gʻiloflarni tikish sexi', 'Каримова Наргиза', 'Мастер швейного участка', 'Автоматический раскрой экокожи и текстиля, контроль качества строчки, натяжения нитей и симметрии.', 'Eko-teri va matolarni avtomatik bichish, chok sifati, ip tarangligi va simmetriya nazorati.', 95.5, 'В норме'),
            ('ws-quality', 'WS-05', 'Служба контроля качества и лаборатория BIQS', 'Sifat nazorati xizmati va BIQS laboratoriyasi', 'Умаров Бахтиёр', 'Руководитель департамента качества', 'Многоуровневые аудиты стандартов BIQS, испытания на долговечность, Fast Response и аудит готовой продукции.', 'BIQS standartlari koʻp bosqichli auditi, chidamlilik sinovlari, Fast Response va tayyor mahsulot auditi.', 99.0, 'Эталон качества')
        ]
        cursor.executemany("""
        INSERT INTO departments (id, code, name_ru, name_uz, head_name, head_role, description_ru, description_uz, compliance_score, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        """, departments_data)

    cursor.execute("DELETE FROM assembly_lines;")
    lines_data = [
        ('line-cobalt', 'ws-assembly', 'Линия сборки Cobalt (Главный конвейер)', 'Сборка сидений Chevrolet Cobalt'),
        ('line-tracker', 'ws-assembly', 'Линия сборки Tracker', 'Сборка автокресел Chevrolet Tracker'),
        ('line-onix', 'ws-assembly', 'Линия сборки Onix', 'Сборка автокресел Chevrolet Onix'),
        ('line-weld-cobalt', 'ws-welding', 'Сварочный пост Cobalt', 'Роботизированная сварка каркасов Cobalt'),
        ('line-weld-tracker', 'ws-welding', 'Сварочный пост Tracker', 'Роботизированная сварка каркасов Tracker'),
        ('line-foam-1', 'ws-foam', 'Линия ППУ-1 (Вспенивание)', 'Формование и заливка подушек сидений'),
        ('line-sew-ecoleather', 'ws-sewing', 'Линия пошива (Экокожа)', 'Автоматический раскрой и пошив экокожи'),
        ('line-sew-textile', 'ws-sewing', 'Линия пошива (Текстиль)', 'Пошив текстильных чехлов'),
        ('line-quality-gate', 'ws-quality', 'Пост контроля BIQS & Fast Response', 'Финишный контроль качества')
    ]
    cursor.executemany("""
    INSERT INTO assembly_lines (id, department_id, name, description)
    VALUES (?, ?, ?, ?);
    """, lines_data)

    target_username = 'admin_master_ov777'
    target_password_hash = hash_password('Uz_Cobalt_2026_Secure#99')

    cursor.execute("SELECT id FROM users WHERE username=?;", (target_username,))
    if not cursor.fetchone():
        cursor.execute("DELETE FROM users WHERE username='admin';")
        cursor.execute("""
            INSERT INTO users (id, username, password, full_name, role, department_id, assigned_lines, is_active)
            VALUES ('usr-super-admin', ?, ?, 'Главный Администратор (Суперадмин)', 'admin', 'all', '', 1);
        """, (target_username, target_password_hash))

    cursor.execute("SELECT COUNT(*) FROM invite_keys;")
    if cursor.fetchone()[0] == 0:
        keys_data = [
            ('inv-1', 'UTH-AUD-9912', 'user', 'ws-quality', 'admin_master_ov777', 50, 0, 1, 'Общий инвайт-код для инспекторов и аудиторов BIQS'),
            ('inv-2', 'UTH-ASM-8841', 'user', 'ws-assembly', 'admin_master_ov777', 50, 0, 1, 'Инвайт-код для сборки (Cobalt / Tracker)'),
            ('inv-3', 'UTH-WLD-5523', 'user', 'ws-welding', 'admin_master_ov777', 50, 0, 1, 'Инвайт-код для цеха сварки'),
            ('inv-4', 'UTH-SEW-3310', 'user', 'ws-sewing', 'admin_master_ov777', 50, 0, 1, 'Инвайт-код для цеха пошива'),
            ('inv-5', 'UTH-FOAM-7721', 'user', 'ws-foam', 'admin_master_ov777', 50, 0, 1, 'Инвайт-код для цеха ППУ')
        ]
        cursor.executemany("""
        INSERT INTO invite_keys (id, key_code, role, department_id, created_by, max_uses, used_count, is_active, note)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
        """, keys_data)

    cursor.execute("SELECT COUNT(*) FROM cobalt_metrics;")
    if cursor.fetchone()[0] == 0:
        cursor.execute("INSERT INTO cobalt_metrics (assembly_pace, target_pace, status) VALUES (145, 150, 'Оптимальный');")

    conn.commit()
    conn.close()

init_db()

app = FastAPI(title='СП «Uz-Tong Hong Co.» BIQS Platform')
app.mount('/static', StaticFiles(directory='static'), name='static')

SESSIONS: Dict[str, Dict[str, Any]] = {}

def get_current_user_from_req(request: Request) -> Optional[Dict[str, Any]]:
    token = request.cookies.get('session_token')
    if not token:
        auth = request.headers.get('Authorization')
        if auth and auth.startswith('Bearer '):
            token = auth.split(' ')[1]
    if token and token in SESSIONS:
        return SESSIONS[token]
    return None

def require_auth(request: Request) -> Dict[str, Any]:
    user = get_current_user_from_req(request)
    if not user:
        raise HTTPException(status_code=401, detail='Неавторизованный доступ / Ruxsat berilmagan')
    return user

class AdminLoginRequest(BaseModel):
    username: str
    password: str

class InviteCodeLoginRequest(BaseModel):
    invite_code: str
    full_name: Optional[str] = ''

class AdminCreateUserRequest(BaseModel):
    username: str
    password: str
    full_name: str
    role: str
    department_id: str
    assigned_lines: Optional[str] = ''

class CreateInviteKeyRequest(BaseModel):
    role: str
    department_id: str
    max_uses: int = 10
    note: Optional[str] = ''

class CreateIssueRequest(BaseModel):
    department_id: str
    line_name: str
    defect_type: str
    severity: str
    description: str
    reporter_name: Optional[str] = ''
    downtime_minutes: Optional[int] = 0
    initial_photo_url: Optional[str] = ''

class AssemblyLineRequest(BaseModel):
    department_id: str
    name: str
    description: Optional[str] = ''

class AssignIssueRequest(BaseModel):
    assigned_to: str

class VerificationRequest(BaseModel):
    action_taken: str
    verification_photo_url: str

class CreateBiqsAuditRequest(BaseModel):
    department_id: str
    line_name: str
    auditor_name: str
    worker_name: str
    worker_knowledge_status: str
    compliance_score: float
    questions: List[Dict[str, Any]]
    violation_photos: List[str] = []
    comments: Optional[str] = ''

@app.get('/auth/super-admin-login', response_class=HTMLResponse)
def get_super_admin_login_page():
    with open('static/super_admin_login.html', 'r', encoding='utf-8') as f:
        return f.read()

@app.post('/api/auth/invite-code-login')
def invite_code_login(req: InviteCodeLoginRequest, request: Request, response: Response):
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT * FROM invite_keys 
        WHERE UPPER(key_code)=UPPER(?) AND is_active=1 AND used_count < max_uses;
    """, (req.invite_code.strip(),))
    invite_row = cursor.fetchone()

    if not invite_row:
        conn.close()
        raise HTTPException(status_code=400, detail='Недействительный или исчерпанный код приглашения')

    invite = dict(invite_row)
    new_used = invite['used_count'] + 1
    new_active = 0 if new_used >= invite['max_uses'] else 1
    cursor.execute("UPDATE invite_keys SET used_count=?, is_active=? WHERE id=?;", (new_used, new_active, invite['id']))
    conn.commit()
    conn.close()

    session_token = secrets.token_hex(32)
    display_name = req.full_name.strip() if req.full_name and req.full_name.strip() else f"Сотрудник ({invite['key_code']})"

    SESSIONS[session_token] = {
        'user_id': f"usr-inv-{uuid.uuid4().hex[:6]}",
        'username': display_name,
        'full_name': display_name,
        'role': 'user',
        'department_id': invite['department_id'],
        'assigned_lines': '',
        'is_guest': False,
        'invite_code': invite['key_code']
    }
    response.set_cookie(key='session_token', value=session_token, httponly=True, max_age=86400*7)
    log_action(SESSIONS[session_token]['user_id'], display_name, 'Вход по инвайт-коду', f"Код: {invite['key_code']}", request.client.host if request.client else '')
    return {'status': 'success', 'user': SESSIONS[session_token], 'session_token': session_token}

@app.post('/api/auth/login')
def admin_login(req: AdminLoginRequest, request: Request, response: Response):
    conn = get_db()
    cursor = conn.cursor()
    pwd_hash = hash_password(req.password.strip())

    cursor.execute("""
        SELECT id, username, password, full_name, role, department_id, assigned_lines, is_active 
        FROM users 
        WHERE LOWER(username)=LOWER(?) AND (password=? OR password=?);
    """, (req.username.strip(), pwd_hash, req.password.strip()))
    row = cursor.fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=401, detail='Неверный логин или пароль Администратора')

    user = dict(row)
    if user.get('is_active') == 0:
        raise HTTPException(status_code=403, detail='Учетная запись деактивирована')

    session_token = secrets.token_hex(32)
    SESSIONS[session_token] = {
        'user_id': user['id'],
        'username': user['username'],
        'full_name': user['full_name'],
        'role': user['role'],
        'department_id': user['department_id'],
        'assigned_lines': user.get('assigned_lines', ''),
        'is_guest': False
    }
    response.set_cookie(key='session_token', value=session_token, httponly=True, max_age=86400*7)
    log_action(user['id'], user['username'], 'Успешная авторизация', f"Роль: {user['role']}", request.client.host if request.client else '')
    return {'status': 'success', 'user': SESSIONS[session_token], 'session_token': session_token}

@app.post('/api/auth/logout')
def logout(request: Request, response: Response):
    token = request.cookies.get('session_token')
    if token and token in SESSIONS:
        u = SESSIONS[token]
        log_action(u['user_id'], u['username'], 'Выход из системы', '', request.client.host if request.client else '')
        del SESSIONS[token]
    response.delete_cookie('session_token')
    return {'status': 'logged_out'}

@app.get('/api/auth/me')
def get_me(request: Request):
    user = get_current_user_from_req(request)
    if user:
        return {'authenticated': True, 'user': user}
    return {'authenticated': False}

@app.get('/api/departments')
def list_departments():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM departments ORDER BY code ASC;")
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return {'departments': rows}

@app.get('/api/lines')
def list_lines(department_id: Optional[str] = None):
    conn = get_db()
    cursor = conn.cursor()
    if department_id and department_id != 'all':
        cursor.execute("""
            SELECT l.*, d.name_ru as dept_name_ru, d.code as dept_code 
            FROM assembly_lines l
            LEFT JOIN departments d ON l.department_id = d.id
            WHERE l.department_id = ? AND l.is_active = 1
            ORDER BY l.name ASC;
        """, (department_id,))
    else:
        cursor.execute("""
            SELECT l.*, d.name_ru as dept_name_ru, d.code as dept_code 
            FROM assembly_lines l
            LEFT JOIN departments d ON l.department_id = d.id
            WHERE l.is_active = 1
            ORDER BY d.code ASC, l.name ASC;
        """)
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return {'lines': rows}

@app.get('/api/issues')
def list_issues(request: Request, department_id: Optional[str] = None):
    user = get_current_user_from_req(request)
    conn = get_db()
    cursor = conn.cursor()

    if user and user['role'] in ['operator', 'shop_head'] and user['department_id'] != 'all':
        query_dept = user['department_id']
        cursor.execute("""
            SELECT i.*, d.name_ru as dept_name_ru, d.name_uz as dept_name_uz, d.code as dept_code
            FROM line_issues i
            LEFT JOIN departments d ON i.department_id = d.id
            WHERE i.department_id = ?
            ORDER BY i.created_at DESC;
        """, (query_dept,))
    else:
        if department_id and department_id != 'all':
            cursor.execute("""
                SELECT i.*, d.name_ru as dept_name_ru, d.name_uz as dept_name_uz, d.code as dept_code
                FROM line_issues i
                LEFT JOIN departments d ON i.department_id = d.id
                WHERE i.department_id = ?
                ORDER BY i.created_at DESC;
            """, (department_id,))
        else:
            cursor.execute("""
                SELECT i.*, d.name_ru as dept_name_ru, d.name_uz as dept_name_uz, d.code as dept_code
                FROM line_issues i
                LEFT JOIN departments d ON i.department_id = d.id
                ORDER BY i.created_at DESC;
            """)

    issues = [dict(r) for r in cursor.fetchall()]
    conn.close()
    user_dept = user['department_id'] if user else 'all'
    user_role = user['role'] if user else 'guest'
    return {'issues': issues, 'user_department': user_dept, 'user_role': user_role}

@app.post('/api/issues/create')
def create_issue(req: CreateIssueRequest, request: Request):
    user = get_current_user_from_req(request)
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) FROM line_issues;")
    cnt = cursor.fetchone()[0] + 1
    ticket_num = f"ISS-2026-{cnt:03d}"
    issue_id = f"iss-{uuid.uuid4().hex[:8]}"

    creator = user['username'] if user else (req.reporter_name or 'Рабочий линии')
    reporter = req.reporter_name.strip() if req.reporter_name else (user['full_name'] if user else 'Линейный сотрудник')

    cursor.execute("""
        INSERT INTO line_issues (
            id, ticket_number, department_id, line_name, defect_type, severity,
            description, status, initial_photo_url, created_by_user, reporter_name, downtime_minutes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, CURRENT_TIMESTAMP);
    """, (issue_id, ticket_num, req.department_id, req.line_name, req.defect_type, req.severity, req.description, req.initial_photo_url, creator, reporter, req.downtime_minutes or 0))

    conn.commit()
    conn.close()

    log_action(user['user_id'] if user else 'anon', reporter, 'Фиксация проблемы на линии', f"№{ticket_num}, Линия: {req.line_name}, Дефект: {req.defect_type}", request.client.host if request.client else '')
    return {'status': 'success', 'issue_id': issue_id, 'ticket_number': ticket_num}

@app.post('/api/issues/{issue_id}/assign')
def assign_issue(issue_id: str, req: AssignIssueRequest, request: Request):
    user = require_auth(request)
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE line_issues 
        SET assigned_to=?, status='assigned', assigned_at=CURRENT_TIMESTAMP
        WHERE id=?;
    """, (req.assigned_to, issue_id))
    conn.commit()
    conn.close()
    log_action(user['user_id'], user['username'], 'Назначение ответственного по проблеме', f"ID: {issue_id} -> {req.assigned_to}")
    return {'status': 'success', 'message': 'Ответственный назначен'}

@app.post('/api/issues/{issue_id}/start')
def start_issue(issue_id: str, request: Request):
    user = require_auth(request)
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("UPDATE line_issues SET status='in_progress' WHERE id=?;", (issue_id,))
    conn.commit()
    conn.close()
    log_action(user['user_id'], user['username'], 'Перевод заявки в работу', f"ID: {issue_id}")
    return {'status': 'success', 'message': 'Задача переведена в работу'}

@app.post('/api/issues/{issue_id}/verify')
def verify_issue(issue_id: str, req: VerificationRequest, request: Request):
    user = require_auth(request)
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE line_issues 
        SET action_taken=?, verification_photo_url=?, status='verification', resolved_at=CURRENT_TIMESTAMP
        WHERE id=?;
    """, (req.action_taken, req.verification_photo_url, issue_id))
    conn.commit()
    conn.close()
    log_action(user['user_id'], user['username'], 'Отправка отчета об устранении дефекта', f"ID: {issue_id}")
    return {'status': 'success', 'message': 'Фото устранения загружено на проверку'}

@app.post('/api/issues/{issue_id}/close')
def close_issue(issue_id: str, request: Request):
    user = require_auth(request)
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("UPDATE line_issues SET status='closed', closed_at=CURRENT_TIMESTAMP WHERE id=?;", (issue_id,))
    conn.commit()
    conn.close()
    log_action(user['user_id'], user['username'], 'Закрытие заявки об устранении', f"ID: {issue_id}")
    return {'status': 'success', 'message': 'Задача успешно закрыта'}

@app.get('/api/audits/biqs')
def list_biqs_audits(department_id: Optional[str] = None):
    conn = get_db()
    cursor = conn.cursor()
    if department_id and department_id != 'all':
        cursor.execute("""
            SELECT a.*, d.name_ru as dept_name_ru, d.name_uz as dept_name_uz, d.code as dept_code
            FROM biqs_audits a
            LEFT JOIN departments d ON a.department_id = d.id
            WHERE a.department_id = ?
            ORDER BY a.created_at DESC;
        """, (department_id,))
    else:
        cursor.execute("""
            SELECT a.*, d.name_ru as dept_name_ru, d.name_uz as dept_name_uz, d.code as dept_code
            FROM biqs_audits a
            LEFT JOIN departments d ON a.department_id = d.id
            ORDER BY a.created_at DESC;
        """)

    rows = [dict(r) for r in cursor.fetchall()]
    for r in rows:
        if r.get('questions_json'):
            r['questions'] = json.loads(r['questions_json'])
        if r.get('violation_photos_json'):
            r['violation_photos'] = json.loads(r['violation_photos_json'])
        else:
            r['violation_photos'] = []

    conn.close()
    return {'audits': rows}

@app.post('/api/audits/biqs')
def create_biqs_audit(req: CreateBiqsAuditRequest, request: Request):
    user = require_auth(request)
    conn = get_db()
    cursor = conn.cursor()

    audit_id = f"BIQS-AUD-{int(time.time())}"
    q_json = json.dumps(req.questions, ensure_ascii=False)
    photos_json = json.dumps(req.violation_photos, ensure_ascii=False)

    cursor.execute("""
        INSERT INTO biqs_audits (
            id, auditor_name, department_id, line_name, compliance_score,
            worker_name, worker_knowledge_status, questions_json, violation_photos_json, comments, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP);
    """, (
        audit_id, req.auditor_name, req.department_id, req.line_name, req.compliance_score,
        req.worker_name, req.worker_knowledge_status, q_json, photos_json, req.comments
    ))

    cursor.execute("UPDATE departments SET compliance_score=? WHERE id=?;", (req.compliance_score, req.department_id))
    conn.commit()
    conn.close()
    log_action(user['user_id'], user['username'], 'Проведение аудита BIQS', f"Аудит {audit_id}, Линия: {req.line_name}, Оценка: {req.compliance_score}%")
    return {'status': 'success', 'audit_id': audit_id}

@app.get('/api/dashboard/summary')
def get_executive_summary():
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) FROM line_issues;")
    total_issues = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM line_issues WHERE status='open';")
    open_issues = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM line_issues WHERE status IN ('assigned', 'in_progress', 'verification');")
    active_issues = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM line_issues WHERE status='closed';")
    closed_issues = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM line_issues WHERE severity='critical_stop';")
    critical_stops = cursor.fetchone()[0]

    cursor.execute("SELECT SUM(downtime_minutes) FROM line_issues;")
    total_downtime = cursor.fetchone()[0] or 0

    cursor.execute("""
        SELECT d.id, d.code, d.name_ru, d.name_uz, d.head_name, d.compliance_score,
               COUNT(i.id) as issue_count,
               SUM(CASE WHEN i.status='open' THEN 1 ELSE 0 END) as open_count,
               SUM(CASE WHEN i.status='closed' THEN 1 ELSE 0 END) as closed_count,
               SUM(COALESCE(i.downtime_minutes, 0)) as total_downtime
        FROM departments d
        LEFT JOIN line_issues i ON d.id = i.department_id
        GROUP BY d.id
        ORDER BY d.code ASC;
    """)
    dept_matrix = [dict(r) for r in cursor.fetchall()]

    cursor.execute("SELECT AVG(compliance_score) FROM departments;")
    avg_score = round(cursor.fetchone()[0] or 95.0, 1)

    cursor.execute("SELECT * FROM cobalt_metrics ORDER BY id DESC LIMIT 1;")
    c_row = cursor.fetchone()
    cobalt_data = dict(c_row) if c_row else {'assembly_pace': 145, 'target_pace': 150, 'status': 'Оптимальный'}

    conn.close()
    return {
        'total_issues': total_issues,
        'open_issues': open_issues,
        'active_issues': active_issues,
        'closed_issues': closed_issues,
        'critical_stops': critical_stops,
        'total_downtime_minutes': total_downtime,
        'avg_biqs_score': avg_score,
        'sla_avg_hours': 1.4,
        'departments_matrix': dept_matrix,
        'cobalt': cobalt_data
    }

@app.get('/api/admin/invite-keys')
def get_invite_keys(request: Request):
    user = require_auth(request)
    if user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail='Доступ только для Главного Администратора')

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT k.*, d.name_ru as dept_name_ru, d.code as dept_code
        FROM invite_keys k
        LEFT JOIN departments d ON k.department_id = d.id
        ORDER BY k.created_at DESC;
    """)
    keys = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return {'keys': keys}

@app.post('/api/admin/invite-keys')
def create_invite_key(req: CreateInviteKeyRequest, request: Request):
    user = require_auth(request)
    if user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail='Доступ только для Главного Администратора')

    conn = get_db()
    cursor = conn.cursor()

    prefix = req.department_id.replace('ws-', '').upper()[:3] if req.department_id != 'all' else 'AUD'
    random_num = secrets.randbelow(9000) + 1000
    generated_code = f"UTH-{prefix}-{random_num}"
    key_id = f"inv-{uuid.uuid4().hex[:8]}"

    cursor.execute("""
        INSERT INTO invite_keys (id, key_code, role, department_id, created_by, max_uses, used_count, is_active, note)
        VALUES (?, ?, ?, ?, ?, ?, 0, 1, ?);
    """, (key_id, generated_code, req.role, req.department_id, user['username'], req.max_uses, req.note))

    conn.commit()
    conn.close()
    log_action(user['user_id'], user['username'], 'Генерация инвайт-кода', f"Код: {generated_code}, Роль: {req.role}")
    return {'status': 'success', 'key_code': generated_code, 'key_id': key_id}

@app.post('/api/admin/invite-keys/{key_id}/toggle')
def toggle_invite_key(key_id: str, request: Request):
    user = require_auth(request)
    if user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail='Доступ только для Главного Администратора')

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("UPDATE invite_keys SET is_active = 1 - is_active WHERE id=?;", (key_id,))
    conn.commit()
    conn.close()
    log_action(user['user_id'], user['username'], 'Изменение статуса инвайт-кода', f"ID: {key_id}")
    return {'status': 'success'}

@app.post('/api/admin/create-user')
def admin_create_user(req: AdminCreateUserRequest, request: Request):
    user = require_auth(request)
    if user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail='Доступ только для Главного Администратора')

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM users WHERE LOWER(username)=LOWER(?);", (req.username.strip(),))
    if cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=400, detail='Пользователь с таким логином уже зарегистрирован')

    new_id = f"usr-{uuid.uuid4().hex[:8]}"
    pwd_hash = hash_password(req.password.strip())

    cursor.execute("""
        INSERT INTO users (id, username, password, full_name, role, department_id, assigned_lines, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1);
    """, (new_id, req.username.strip(), pwd_hash, req.full_name.strip(), req.role, req.department_id, req.assigned_lines or ''))
    conn.commit()
    conn.close()
    log_action(user['user_id'], user['username'], 'Создание пользователя', f"Логин: {req.username}, ФИО: {req.full_name}, Роль: {req.role}")
    return {'status': 'success', 'user_id': new_id}

@app.post('/api/admin/users/{user_id}/toggle')
def toggle_user_active(user_id: str, request: Request):
    user = require_auth(request)
    if user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail='Доступ только для Главного Администратора')

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("UPDATE users SET is_active = 1 - is_active WHERE id=?;", (user_id,))
    conn.commit()
    conn.close()
    log_action(user['user_id'], user['username'], 'Изменение статуса пользователя', f"User ID: {user_id}")
    return {'status': 'success'}

@app.get('/api/admin/users')
def list_users(request: Request):
    user = require_auth(request)
    if user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail='Доступ только для Главного Администратора')

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT u.id, u.username, u.full_name, u.role, u.department_id, u.assigned_lines, u.is_active, u.created_at,
               d.name_ru as dept_name_ru, d.code as dept_code
        FROM users u
        LEFT JOIN departments d ON u.department_id = d.id
        ORDER BY u.created_at DESC;
    """)
    users = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return {'users': users}

@app.post('/api/admin/lines')
def create_assembly_line(req: AssemblyLineRequest, request: Request):
    user = require_auth(request)
    if user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail='Доступ только для Администратора')

    conn = get_db()
    cursor = conn.cursor()
    line_id = f"line-{uuid.uuid4().hex[:6]}"

    cursor.execute("""
        INSERT INTO assembly_lines (id, department_id, name, description, is_active)
        VALUES (?, ?, ?, ?, 1);
    """, (line_id, req.department_id, req.name.strip(), req.description.strip()))

    conn.commit()
    conn.close()
    log_action(user['user_id'], user['username'], 'Создание линии сборки', f"Линия: {req.name}, Цех: {req.department_id}")
    return {'status': 'success', 'line_id': line_id}

@app.delete('/api/admin/lines/{line_id}')
def delete_assembly_line(line_id: str, request: Request):
    user = require_auth(request)
    if user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail='Доступ только для Администратора')

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("UPDATE assembly_lines SET is_active = 0 WHERE id=?;", (line_id,))
    conn.commit()
    conn.close()
    log_action(user['user_id'], user['username'], 'Удаление линии сборки', f"ID: {line_id}")
    return {'status': 'success'}

@app.get('/api/admin/logs')
def get_system_logs(request: Request, limit: int = 50):
    user = require_auth(request)
    if user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail='Доступ только для Администратора')

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM system_logs ORDER BY created_at DESC LIMIT ?;", (limit,))
    logs = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return {'logs': logs}

class Base64PhotoUploadRequest(BaseModel):
    image_data: str
    filename_prefix: Optional[str] = 'defect'

@app.post('/api/upload/photo')
def upload_base64_photo(req: Base64PhotoUploadRequest):
    try:
        data = req.image_data
        if ',' in data:
            data = data.split(',')[1]
        img_bytes = base64.b64decode(data)
        filename = f"{req.filename_prefix}_{int(time.time())}_{secrets.token_hex(4)}.jpg"
        filepath = os.path.join(UPLOAD_DIR, filename)
        with open(filepath, 'wb') as f:
            f.write(img_bytes)
        return {'status': 'success', 'photo_url': f"/static/uploads/{filename}"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Ошибка обработки изображения: {str(e)}")

@app.post('/api/auth/guest-login')
def guest_login(response: Response):
    session_token = secrets.token_hex(32)
    SESSIONS[session_token] = {
        'user_id': f'guest-{uuid.uuid4().hex[:6]}',
        'username': 'Гость / Mehmon',
        'full_name': 'Гостевой просмотр (Demo)',
        'role': 'guest',
        'department_id': 'all',
        'is_guest': True
    }
    response.set_cookie(key='session_token', value=session_token, httponly=True, max_age=3600)
    return {'status': 'success', 'user': SESSIONS[session_token], 'session_token': session_token}

@app.get('/', response_class=HTMLResponse)
def index():
    with open('static/index.html', 'r', encoding='utf-8') as f:
        return f.read()

if __name__ == '__main__':
    uvicorn.run('server:app', host='0.0.0.0', port=8080, reload=True)
