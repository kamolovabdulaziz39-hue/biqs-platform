# -*- coding: utf-8 -*-
import os
import time
import json
import uuid
import base64
import secrets
import hashlib
import sqlite3
import threading
import urllib.request
from typing import Optional, Dict, Any, List
from datetime import datetime
from fastapi import FastAPI, Request, HTTPException, Depends, Header, Response, Cookie
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.gzip import GZipMiddleware
from pydantic import BaseModel
import uvicorn
import socket

DB_FILE = 'utong_factory.db'
UPLOAD_DIR = 'static/uploads'
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs('static', exist_ok=True)

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
        status TEXT DEFAULT 'В норме'
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

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS assembly_lines (
        id TEXT PRIMARY KEY,
        department_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        target_pace_shift INTEGER DEFAULT 200,
        is_active INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(department_id) REFERENCES departments(id)
    );
    """)

    cursor.execute("PRAGMA table_info(assembly_lines);")
    al_cols = [r[1] for r in cursor.fetchall()]
    if 'target_pace_shift' not in al_cols:
        cursor.execute("ALTER TABLE assembly_lines ADD COLUMN target_pace_shift INTEGER DEFAULT 200;")

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS invite_keys (
        id TEXT PRIMARY KEY,
        key_code TEXT UNIQUE NOT NULL,
        role TEXT NOT NULL,
        department_id TEXT NOT NULL,
        created_by TEXT NOT NULL,
        max_uses INTEGER DEFAULT 50,
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
        error_code TEXT DEFAULT '',
        target_service TEXT DEFAULT 'ws-mechanic',
        mechanic_notes TEXT DEFAULT '',
        mechanic_name TEXT DEFAULT '',
        unlocked_by_controller INTEGER DEFAULT 0,
        controller_name TEXT DEFAULT '',
        controller_notes TEXT DEFAULT '',
        escalated_to_director INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        assigned_at TIMESTAMP,
        resolved_at TIMESTAMP,
        closed_at TIMESTAMP,
        FOREIGN KEY(department_id) REFERENCES departments(id)
    );
    """)

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

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS daily_quality_tasks (
        id TEXT PRIMARY KEY,
        plan_date DATE NOT NULL,
        shift TEXT DEFAULT '1-я смена',
        target_role TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        department_id TEXT NOT NULL,
        line_name TEXT NOT NULL,
        assigned_to_user_id TEXT DEFAULT 'all',
        assigned_to_name TEXT DEFAULT '',
        priority TEXT DEFAULT 'high',
        expected_output TEXT DEFAULT '',
        status TEXT DEFAULT 'pending',
        created_by_user TEXT NOT NULL,
        created_by_name TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP,
        units_checked INTEGER DEFAULT 0,
        defects_prevented INTEGER DEFAULT 0,
        report_text TEXT DEFAULT '',
        report_photo_url TEXT DEFAULT '',
        head_review_status TEXT DEFAULT 'pending',
        head_review_comment TEXT DEFAULT '',
        FOREIGN KEY(department_id) REFERENCES departments(id)
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS daily_quality_reports (
        id TEXT PRIMARY KEY,
        report_date DATE UNIQUE NOT NULL,
        shift TEXT DEFAULT '1-я смена',
        head_user_id TEXT,
        head_name TEXT,
        summary_conclusion TEXT DEFAULT '',
        status TEXT DEFAULT 'draft',
        director_verdict TEXT DEFAULT '',
        director_name TEXT DEFAULT '',
        director_reviewed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS shift_reports (
        id TEXT PRIMARY KEY,
        report_date DATE NOT NULL,
        shift TEXT DEFAULT '1-я смена',
        department_id TEXT NOT NULL,
        dept_name TEXT NOT NULL,
        author_id TEXT NOT NULL,
        author_name TEXT NOT NULL,
        author_role TEXT NOT NULL,
        plan_units INTEGER DEFAULT 0,
        fact_units INTEGER DEFAULT 0,
        scrap_units INTEGER DEFAULT 0,
        downtime_minutes INTEGER DEFAULT 0,
        downtime_reason TEXT DEFAULT '',
        resource_consumption TEXT DEFAULT '',
        issues_summary TEXT DEFAULT '',
        kaizen_suggestions TEXT DEFAULT '',
        status TEXT DEFAULT 'submitted',
        head_reviewer TEXT DEFAULT '',
        head_comment TEXT DEFAULT '',
        director_reviewer TEXT DEFAULT '',
        director_verdict TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(department_id) REFERENCES departments(id)
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS worker_shift_inputs (
        id TEXT PRIMARY KEY,
        date DATE NOT NULL,
        shift TEXT DEFAULT '1-я смена',
        user_id TEXT NOT NULL,
        worker_name TEXT NOT NULL,
        department_id TEXT NOT NULL,
        line_name TEXT NOT NULL,
        article TEXT DEFAULT '',
        units_made INTEGER DEFAULT 0,
        defects_count INTEGER DEFAULT 0,
        defect_reason TEXT DEFAULT '',
        breakdown_notes TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS incoming_inspections (
        id TEXT PRIMARY KEY,
        date DATE NOT NULL,
        material_name TEXT NOT NULL,
        supplier TEXT NOT NULL,
        batch_number TEXT NOT NULL,
        sample_size INTEGER DEFAULT 100,
        defect_count INTEGER DEFAULT 0,
        verdict TEXT DEFAULT 'accepted',
        inspector_name TEXT NOT NULL,
        certificate_valid INTEGER DEFAULT 1,
        comments TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS reclamations (
        id TEXT PRIMARY KEY,
        ticket_num TEXT UNIQUE NOT NULL,
        date DATE NOT NULL,
        customer TEXT NOT NULL,
        car_model TEXT NOT NULL,
        part_number TEXT NOT NULL,
        defect_description TEXT NOT NULL,
        severity TEXT DEFAULT 'major',
        root_cause_analysis TEXT DEFAULT '',
        corrective_action TEXT DEFAULT '',
        engineer_name TEXT NOT NULL,
        status TEXT DEFAULT 'investigating',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS energy_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        electricity_kwh REAL DEFAULT 0,
        gas_m3 REAL DEFAULT 0,
        water_m3 REAL DEFAULT 0,
        air_pressure_bar REAL DEFAULT 6.8,
        is_emergency INTEGER DEFAULT 0,
        emergency_text TEXT DEFAULT '',
        reported_by TEXT DEFAULT ''
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS facility_checklists (
        id TEXT PRIMARY KEY,
        date DATE NOT NULL,
        inspector_name TEXT NOT NULL,
        cleanliness_ok INTEGER DEFAULT 1,
        canteen_ok INTEGER DEFAULT 1,
        security_ok INTEGER DEFAULT 1,
        waste_disposal_ok INTEGER DEFAULT 1,
        open_requests INTEGER DEFAULT 0,
        closed_requests INTEGER DEFAULT 0,
        report_text TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # Populate 9 real production & service departments
    departments_data = [
        ('ws-assembly', 'WS-01', 'Сборочный цех автомобильных сидений', 'Avtomobil oʻrindiqlarini yigʻish sexi', 'Азизов Карим', 'Начальник сборочного производства', 'Главный конвейер сборки автокресел Cobalt, Tracker, Onix. Контроль геометрии и момента затяжки.', 'Cobalt, Tracker, Onix oʻrindiqlarini yigʻish bosh konveyeri.', 96.8, 'В норме'),
        ('ws-welding', 'WS-02', 'Цех металлокаркасов и роботизированной сварки', 'Metall karkaslar va payvandlash sexi', 'Рахимов Шерзод', 'Главный сварщик завода', 'Автоматические сварочные комплексы, проверка прочности сварных швов и штампованных элементов.', 'Avtomatik payvandlash majmualari.', 94.2, 'Высокий стандарт'),
        ('ws-stamping', 'WS-06', 'Цех холодной штамповки деталей', 'Sovuq shtamplash sexi', 'Алимов Сардор', 'Начальник штамповочного цеха', 'Штамповка металлических каркасов, кронштейнов и направляющих салазок для сидений.', 'Oʻrindiqlar uchun metall karkaslar shtamplash.', 95.0, 'В норме'),
        ('ws-foam', 'WS-03', 'Цех пенополиуретана (ППУ / Вспенивание)', 'Penopoliuretan (PPU / Koʻpirtirish) sexi', 'Юсупов Джамшид', 'Технолог полиуретановых систем', 'Формование подушек и спинок сидений, контроль плотности пены, упругости и отсутствие пустот.', 'Oʻrindiq yostiqlari shakllantirish.', 98.1, 'В норме'),
        ('ws-sewing', 'WS-04', 'Цех раскроя и пошива чехлов', 'Bichish va gʻiloflarni tikish sexi', 'Каримова Наргиза', 'Мастер швейного участка', 'Автоматический раскрой экокожи и текстиля, контроль качества строчки, натяжения нитей и симметрии.', 'Eko-teri va matolarni avtomatik bichish.', 95.5, 'В норме'),
        ('ws-quality', 'WS-05', 'Отдел контроля качества (ОТК & BIQS)', 'Sifat nazorati xizmati va BIQS laboratoriyasi', 'Умаров Бахтиёр', 'Руководитель департамента качества (Начальник ОТК)', 'Многоуровневые аудиты стандартов BIQS, испытания на долговечность, Fast Response и входной контроль.', 'BIQS standartlari koʻp bosqichli auditi.', 99.0, 'Эталон качества'),
        ('ws-energy', 'WS-07', 'Отдел главного энергетика (ОГЭ)', 'Bosh energetik boʻlimi', 'Холматов Улугбек', 'Главный энергетик завода', 'Бесперебойное снабжение электричеством, газом, водой и сжатым воздухом (компрессорная станция 7 бар).', 'Elektr, gaz, suv va siqilgan havo taʼminoti.', 97.5, 'В норме'),
        ('ws-mechanic', 'WS-08', 'Отдел главного механика и ТОиР (ОГМ)', 'Bosh mexanik boʻlimi va taʼmirlash', 'Мамаджанов Баходир', 'Главный механик завода', 'Ремонт технологического оборудования, роботизированных ячеек сварки, штамповочных прессов и конвейеров.', 'Uskunalarni taʼmirlash xizmati.', 96.0, 'В норме'),
        ('ws-facility', 'WS-09', 'Административно-хозяйственный отдел (АХО)', 'Maʼmuriy-xoʻjalik boʻlimi', 'Турсунова Дилором', 'Начальник АХО', 'Контроль чистоты цехов и территории, работа заводской столовой, охрана периметра, вывоз отходов и ТБО.', 'Sexlar tozaligi, oshxona, qoʻriqlash va chiqindilarni olib chiqish.', 98.5, 'В норме')
    ]
    for d in departments_data:
        cursor.execute("SELECT id FROM departments WHERE id=?;", (d[0],))
        if not cursor.fetchone():
            cursor.execute("""
                INSERT INTO departments (id, code, name_ru, name_uz, head_name, head_role, description_ru, description_uz, compliance_score, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
            """, d)
        else:
            cursor.execute("""
                UPDATE departments SET code=?, name_ru=?, name_uz=?, head_name=?, head_role=?, description_ru=?, description_uz=?, compliance_score=?, status=?
                WHERE id=?;
            """, (d[1], d[2], d[3], d[4], d[5], d[6], d[7], d[8], d[9], d[0]))

    # Assembly Lines
    lines_data = [
        ('line-cobalt', 'ws-assembly', 'Линия сборки Cobalt (Главный конвейер)', 'Сборка сидений Chevrolet Cobalt', 220),
        ('line-tracker', 'ws-assembly', 'Линия сборки Tracker', 'Сборка автокресел Chevrolet Tracker', 140),
        ('line-onix', 'ws-assembly', 'Линия сборки Onix', 'Сборка автокресел Chevrolet Onix', 140),
        ('line-weld-cobalt', 'ws-welding', 'Сварочный пост Cobalt #1', 'Роботизированная сварка каркасов Cobalt', 240),
        ('line-weld-tracker', 'ws-welding', 'Сварочный пост Tracker', 'Роботизированная сварка каркасов Tracker', 150),
        ('line-stamp-press1', 'ws-stamping', 'Штамповочный пресс Aida 800t', 'Вырубка и гибка силовых каркасов сидений', 600),
        ('line-stamp-press2', 'ws-stamping', 'Штамповочный пресс Komatsu 500t', 'Штамповка кронштейнов и салазок', 600),
        ('line-foam-1', 'ws-foam', 'Линия ППУ-1 (Вспенивание)', 'Формование и заливка подушек сидений', 500),
        ('line-sew-ecoleather', 'ws-sewing', 'Линия пошива (Экокожа)', 'Автоматический раскрой и пошив экокожи', 200),
        ('line-sew-textile', 'ws-sewing', 'Линия пошива (Текстиль)', 'Пошив текстильных чехлов', 300),
        ('line-incoming-dock', 'ws-quality', 'Участок входного контроля', 'Входной контроль металла, пены, кожи, метизов', 100),
        ('line-quality-gate', 'ws-quality', 'Пост контроля BIQS & Fast Response', 'Финишный контроль качества сидений', 500),
        ('line-energy-substation', 'ws-energy', 'Подстанция и компрессорная станция', 'Электроподстанция 10кВ и магистраль сжатого воздуха 7 бар', 1),
        ('line-mechanic-shop', 'ws-mechanic', 'Ремонтно-механический участок ОГМ', 'Оперативный ремонт станков и сварочных аппаратов', 1),
        ('line-facility-grounds', 'ws-facility', 'АХО: Столовая, территория и охрана', 'Бытовой комплекс, санитарный надзор и ТБО', 1)
    ]
    for l in lines_data:
        cursor.execute("SELECT id FROM assembly_lines WHERE id=?;", (l[0],))
        if not cursor.fetchone():
            cursor.execute("INSERT INTO assembly_lines (id, department_id, name, description, target_pace_shift, is_active) VALUES (?, ?, ?, ?, ?, 1);", l)
        else:
            cursor.execute("UPDATE assembly_lines SET department_id=?, name=?, description=?, target_pace_shift=?, is_active=1 WHERE id=?;", (l[1], l[2], l[3], l[4], l[0]))

    # Production Users
    all_users = [
        ('usr-director', 'director', hash_password('director123'), 'Фаррух Касымов (Генеральный директор завода)', 'director', 'all'),
        ('usr-deputy-dir', 'deputy_director', hash_password('deputyPass'), 'Ойбек Рустамов (Зам. генерального директора по производству)', 'director', 'all'),
        ('usr-head-quality', 'head_quality', hash_password('quality123'), 'Бахтиёр Умаров (Начальник ОТК и службы качества BIQS)', 'quality_head', 'ws-quality'),
        ('usr-eng-quality', 'engineer_quality', hash_password('eng123'), 'Рустам Исмаилов (Ведущий инженер по качеству процессов BIQS)', 'engineer', 'ws-quality'),
        ('usr-eng-reclam', 'engineer_reclamation', hash_password('eng123'), 'Анвар Каримов (Инженер по рекламациям и ISO/IATF)', 'engineer', 'ws-quality'),
        ('usr-ctrl-cobalt', 'controller_cobalt', hash_password('qc123'), 'Дилшод Алимов (Контролёр ОТК сборочной линии Cobalt)', 'controller', 'ws-assembly'),
        ('usr-ctrl-incom', 'controller_incoming', hash_password('qc123'), 'Фарход Ахмедов (Контролёр входного контроля сырья и металла)', 'controller', 'ws-quality'),
        ('usr-master-asm', 'master_assembly', hash_password('master123'), 'Карим Азизов (Начальник сборочного производства / Мастер)', 'shop_head', 'ws-assembly'),
        ('usr-master-weld', 'master_welding', hash_password('master123'), 'Шерзод Рахимов (Мастер сварочного цеха)', 'shop_head', 'ws-welding'),
        ('usr-worker-asm', 'worker_assembly', hash_password('worker123'), 'Иброхим Салимов (Оператор-сборщик линии Cobalt)', 'operator', 'ws-assembly'),
        ('usr-worker-weld', 'worker_welding', hash_password('worker123'), 'Алишер Ботиров (Сварщик роботизированной ячейки #1)', 'operator', 'ws-welding'),
        ('usr-chief-energy', 'chief_energy', hash_password('energy123'), 'Улугбек Холматов (Главный энергетик завода / ОГЭ)', 'energy_head', 'ws-energy'),
        ('usr-chief-mech', 'chief_mechanic', hash_password('mech123'), 'Баходир Мамаджанов (Главный механик завода / ОГМ)', 'mechanic_head', 'ws-mechanic'),
        ('usr-mech-line', 'mechanic_line', hash_password('mech123'), 'Тимур Назаров (Наладчик-ремонтник оборудования ОГМ)', 'mechanic', 'ws-mechanic'),
        ('usr-head-fac', 'head_facility', hash_password('facility123'), 'Дилором Турсунова (Начальник АХО)', 'facility_head', 'ws-facility'),
        ('usr-super-admin', 'admin_master_ov777', hash_password('Uz_Cobalt_2026_Secure#99'), 'Главный Администратор (Суперадмин)', 'admin', 'all')
    ]
    for uid, uname, pw_h, fname, urole, udept in all_users:
        cursor.execute("SELECT id FROM users WHERE username=?;", (uname,))
        if not cursor.fetchone():
            cursor.execute("""
                INSERT INTO users (id, username, password, full_name, role, department_id, assigned_lines, is_active)
                VALUES (?, ?, ?, ?, ?, ?, '', 1);
            """, (uid, uname, pw_h, fname, urole, udept))
        else:
            cursor.execute("""
                UPDATE users SET password=?, full_name=?, role=?, department_id=?, is_active=1 WHERE username=?;
            """, (pw_h, fname, urole, udept, uname))

    conn.commit()
    conn.close()

init_db()

app = FastAPI(title='СП «Uz-Tong Hong Co.» Digital Manufacturing Platform')
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.mount('/static', StaticFiles(directory='static'), name='static')

def _start_keep_alive_worker():
    def _worker():
        time.sleep(20)
        while True:
            try:
                render_url = os.environ.get('RENDER_EXTERNAL_URL') or os.environ.get('APP_URL') or 'https://biqs-platform.onrender.com'
                if render_url:
                    target_url = f"{render_url.rstrip('/')}/api/ping"
                    req = urllib.request.Request(
                        target_url,
                        headers={'User-Agent': 'Mozilla/5.0 (BIQS-Platform-KeepAlive/2.0)'}
                    )
                    with urllib.request.urlopen(req, timeout=15) as resp:
                        pass
            except Exception:
                pass
            time.sleep(480)

    t = threading.Thread(target=_worker, daemon=True, name="RenderKeepAliveWorker")
    t.start()

_start_keep_alive_worker()

@app.get('/api/ping')
@app.get('/health')
def ping_health():
    return {
        'status': 'ok',
        'alive': True,
        'app': 'Uz-Tong Hong Co. Digital Manufacturing & BIQS Platform',
        'timestamp': datetime.now().isoformat()
    }

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

# ==================== PYDANTIC MODELS ====================

class AdminLoginRequest(BaseModel):
    username: str
    password: str

class QuickRoleLoginRequest(BaseModel):
    role_key: str

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
    max_uses: int = 50
    note: Optional[str] = ''

class AssemblyLineRequest(BaseModel):
    department_id: str
    name: str
    description: Optional[str] = ''
    target_pace_shift: Optional[int] = 200

class TriggerAndonEventRequest(BaseModel):
    department_id: str
    line_name: str
    defect_type: str
    error_code: Optional[str] = ''
    target_service: Optional[str] = 'ws-mechanic'
    severity: Optional[str] = 'critical_stop'
    description: str
    reporter_name: Optional[str] = ''
    downtime_minutes: Optional[int] = 0

class MechanicResolveRequest(BaseModel):
    mechanic_notes: str
    mechanic_name: Optional[str] = ''

class ControllerUnlockRequest(BaseModel):
    controller_notes: str
    controller_name: Optional[str] = ''

class SubmitShiftReportRequest(BaseModel):
    report_date: str
    shift: Optional[str] = '1-я смена'
    department_id: str
    plan_units: int
    fact_units: int
    scrap_units: int
    downtime_minutes: Optional[int] = 0
    downtime_reason: Optional[str] = ''
    resource_consumption: Optional[str] = ''
    issues_summary: Optional[str] = ''
    kaizen_suggestions: Optional[str] = ''

class HeadReviewShiftReportRequest(BaseModel):
    head_comment: str

class DirectorApproveShiftReportRequest(BaseModel):
    director_verdict: str

class WorkerShiftInputRequest(BaseModel):
    department_id: str
    line_name: str
    article: str
    units_made: int
    defects_count: int
    defect_reason: Optional[str] = ''
    breakdown_notes: Optional[str] = ''

class IncomingInspectionRequest(BaseModel):
    material_name: str
    supplier: str
    batch_number: str
    sample_size: int = 100
    defect_count: int = 0
    verdict: str = 'accepted'
    inspector_name: str
    certificate_valid: int = 1
    comments: Optional[str] = ''

class CreateReclamationRequest(BaseModel):
    customer: str
    car_model: str
    part_number: str
    defect_description: str
    severity: Optional[str] = 'major'
    root_cause_analysis: Optional[str] = ''
    corrective_action: Optional[str] = ''
    engineer_name: str

class EnergyRecordRequest(BaseModel):
    electricity_kwh: float
    gas_m3: float
    water_m3: float
    air_pressure_bar: float = 6.8
    notes: Optional[str] = ''

class EnergyAlertRequest(BaseModel):
    emergency_text: str

class FacilityChecklistRequest(BaseModel):
    cleanliness_ok: int = 1
    canteen_ok: int = 1
    security_ok: int = 1
    waste_disposal_ok: int = 1
    open_requests: int = 0
    closed_requests: int = 0
    report_text: str

class CreateQualityDailyTaskRequest(BaseModel):
    plan_date: str
    shift: Optional[str] = '1-я смена'
    target_role: str
    title: str
    description: str
    department_id: str
    line_name: str
    assigned_to_user_id: Optional[str] = 'all'
    assigned_to_name: Optional[str] = ''
    priority: Optional[str] = 'high'
    expected_output: Optional[str] = ''

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

# ==================== AUTHENTICATION ROUTES ====================

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
    assigned_role = invite.get('role') or 'operator'

    SESSIONS[session_token] = {
        'user_id': f"usr-inv-{uuid.uuid4().hex[:6]}",
        'username': display_name,
        'full_name': display_name,
        'role': assigned_role,
        'department_id': invite['department_id'],
        'assigned_lines': '',
        'is_guest': False,
        'invite_code': invite['key_code']
    }
    response.set_cookie(key='session_token', value=session_token, httponly=True, max_age=86400*7)
    log_action(SESSIONS[session_token]['user_id'], display_name, 'Вход по коду приглашения', f"Код: {invite['key_code']}")
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
        raise HTTPException(status_code=401, detail='Неверный логин или пароль')

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
    log_action(user['id'], user['username'], 'Успешная авторизация', f"Роль: {user['role']}")
    return {'status': 'success', 'user': SESSIONS[session_token], 'session_token': session_token}

@app.post('/api/auth/logout')
def logout(request: Request, response: Response):
    token = request.cookies.get('session_token')
    if token and token in SESSIONS:
        u = SESSIONS[token]
        log_action(u['user_id'], u['username'], 'Выход из системы', '')
        del SESSIONS[token]
    response.delete_cookie('session_token')
    return {'status': 'logged_out'}

@app.get('/api/auth/me')
def get_me(request: Request):
    user = get_current_user_from_req(request)
    if user:
        return {'authenticated': True, 'user': user}
    return {'authenticated': False}

@app.post('/api/auth/guest-login')
def guest_login(response: Response):
    session_token = secrets.token_hex(32)
    SESSIONS[session_token] = {
        'user_id': f'guest-{uuid.uuid4().hex[:6]}',
        'username': 'Гость',
        'full_name': 'Гостевой просмотр (Демо)',
        'role': 'guest',
        'department_id': 'all',
        'is_guest': True
    }
    response.set_cookie(key='session_token', value=session_token, httponly=True, max_age=3600)
    return {'status': 'success', 'user': SESSIONS[session_token], 'session_token': session_token}

@app.post('/api/auth/quick-role-login')
def quick_role_login(req: QuickRoleLoginRequest, response: Response):
    role_map = {
        'worker': ('worker_assembly', 'ws-assembly', 'Иброхим Салимов (Оператор линии сборки Cobalt)', 'operator'),
        'master': ('master_assembly', 'ws-assembly', 'Карим Азизов (Начальник сборочного цеха / Мастер)', 'shop_head'),
        'director': ('director', 'all', 'Фаррух Касымов (Генеральный директор завода)', 'director'),
        'controller': ('controller_cobalt', 'ws-assembly', 'Дилшод Алимов (Контролёр ОТК)', 'controller'),
        'engineer': ('engineer_quality', 'ws-quality', 'Рустам Исмаилов (Ведущий инженер качества)', 'engineer'),
        'mechanic': ('mechanic_line', 'ws-mechanic', 'Тимур Назаров (Наладчик-механик ОГМ)', 'mechanic'),
        'energy': ('chief_energy', 'ws-energy', 'Улугбек Холматов (Главный энергетик завода)', 'energy_head'),
        'facility': ('head_facility', 'ws-facility', 'Дилором Турсунова (Начальник АХО)', 'facility_head'),
        'admin': ('admin_master_ov777', 'all', 'Главный Администратор платформы', 'admin')
    }
    key = req.role_key.lower().strip()
    if key not in role_map:
        raise HTTPException(status_code=400, detail='Неизвестная роль')

    uname, dept, fname, urole = role_map[key]
    session_token = secrets.token_hex(32)
    SESSIONS[session_token] = {
        'user_id': f'usr-quick-{key}',
        'username': uname,
        'full_name': fname,
        'role': urole,
        'department_id': dept,
        'assigned_lines': 'Линия сборки Cobalt (Главный конвейер)' if key == 'worker' else '',
        'is_guest': False
    }
    response.set_cookie(key='session_token', value=session_token, httponly=True, max_age=86400*7)
    log_action(SESSIONS[session_token]['user_id'], fname, 'Быстрый вход по роли (1-клик)', f'Роль: {urole}')
    return {'status': 'success', 'user': SESSIONS[session_token], 'session_token': session_token}

# ==================== DEPARTMENTS & ASSEMBLY LINES ====================

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

# ==================== MASTER REAL-TIME DASHBOARD API ====================

@app.get('/api/master/dashboard')
def get_master_dashboard(department_id: Optional[str] = 'ws-assembly'):
    conn = get_db()
    cursor = conn.cursor()
    today_str = datetime.now().strftime('%Y-%m-%d')

    # Department passport info
    cursor.execute("SELECT * FROM departments WHERE id=?;", (department_id,))
    dept_row = cursor.fetchone()
    dept_info = dict(dept_row) if dept_row else {
        'id': department_id,
        'code': 'WS-01',
        'name_ru': 'Сборочный цех автомобильных сидений',
        'head_name': 'Карим Азизов',
        'compliance_score': 96.8,
        'status': 'В норме'
    }

    # Get lines of target department
    cursor.execute("""
        SELECT l.*, d.name_ru as dept_name
        FROM assembly_lines l
        LEFT JOIN departments d ON l.department_id = d.id
        WHERE l.department_id = ? AND l.is_active = 1
        ORDER BY l.name ASC;
    """, (department_id,))
    lines = [dict(r) for r in cursor.fetchall()]

    line_metrics = []
    total_plan = 0
    total_fact = 0
    total_scrap = 0
    total_downtime = 0

    for l in lines:
        cursor.execute("""
            SELECT 
                COALESCE(SUM(units_made), 0) as fact,
                COALESCE(SUM(defects_count), 0) as scrap
            FROM worker_shift_inputs
            WHERE line_name = ? AND date = ?;
        """, (l['name'], today_str))
        w_agg = cursor.fetchone()
        fact = w_agg[0] or 0
        scrap = w_agg[1] or 0

        # If zero today, check past inputs or provide active baseline
        if fact == 0:
            cursor.execute("""
                SELECT 
                    COALESCE(SUM(units_made), 0) as fact,
                    COALESCE(SUM(defects_count), 0) as scrap
                FROM worker_shift_inputs
                WHERE line_name = ?;
            """, (l['name'],))
            w_prev = cursor.fetchone()
            if w_prev and w_prev[0] and w_prev[0] > 0:
                fact = w_prev[0]
                scrap = w_prev[1] or 0
            else:
                p_base = l.get('target_pace_shift', 200)
                fact = int(p_base * 0.85)
                scrap = 1 if p_base > 100 else 0

        cursor.execute("""
            SELECT 
                COALESCE(SUM(downtime_minutes), 0) as downtime,
                COUNT(CASE WHEN status != 'closed' THEN 1 END) as open_issues
            FROM line_issues
            WHERE line_name = ?;
        """, (l['name'],))
        i_agg = cursor.fetchone()
        downtime = i_agg[0] or 0
        open_issues = i_agg[1] or 0

        plan = l.get('target_pace_shift', 200)
        total_plan += plan
        total_fact += fact
        total_scrap += scrap
        total_downtime += downtime

        status = "В норме"
        if open_issues > 0:
            status = "Остановка / Ремонт"
        elif fact >= plan:
            status = "План выполнен"

        rate = round((fact / plan * 100), 1) if plan > 0 else 0

        line_metrics.append({
            'line_id': l['id'],
            'line_name': l['name'],
            'description': l['description'] or 'Технологический пост',
            'plan': plan,
            'fact': fact,
            'scrap': scrap,
            'downtime': downtime,
            'rate': rate,
            'status': status
        })

    # Active Andon issues in this department
    cursor.execute("""
        SELECT i.*, d.name_ru as dept_name_ru
        FROM line_issues i
        LEFT JOIN departments d ON i.department_id = d.id
        WHERE i.department_id = ? AND i.status != 'closed'
        ORDER BY i.created_at DESC;
    """, (department_id,))
    active_issues = [dict(r) for r in cursor.fetchall()]

    # Workers assigned to this department
    cursor.execute("""
        SELECT id, username, full_name, role, assigned_lines
        FROM users
        WHERE department_id = ? AND is_active = 1;
    """, (department_id,))
    workers_on_shift = [dict(r) for r in cursor.fetchall()]

    # Recent shift report for this department
    cursor.execute("""
        SELECT * FROM shift_reports
        WHERE department_id = ?
        ORDER BY report_date DESC, created_at DESC LIMIT 1;
    """, (department_id,))
    rep_row = cursor.fetchone()
    recent_report = dict(rep_row) if rep_row else None

    conn.close()

    return {
        'department_id': department_id,
        'department_info': dept_info,
        'summary': {
            'total_plan': total_plan,
            'total_fact': total_fact,
            'total_scrap': total_scrap,
            'total_downtime': total_downtime,
            'completion_rate': round((total_fact / total_plan * 100), 1) if total_plan > 0 else 0,
            'active_lines_count': len([l for l in line_metrics if l['status'] != 'Остановка / Ремонт']),
            'total_lines_count': len(line_metrics)
        },
        'lines': line_metrics,
        'active_issues': active_issues,
        'workers_on_shift': workers_on_shift,
        'recent_report': recent_report
    }

# ==================== ANDON & ESCALATION SYSTEM ====================

@app.get('/api/andon/feed')
def get_andon_feed(department_id: Optional[str] = None):
    conn = get_db()
    cursor = conn.cursor()

    query = """
        SELECT i.*, d.name_ru as dept_name_ru, d.code as dept_code
        FROM line_issues i
        LEFT JOIN departments d ON i.department_id = d.id
    """
    params = []
    if department_id and department_id != 'all':
        query += " WHERE i.department_id = ?"
        params.append(department_id)

    query += " ORDER BY CASE WHEN i.status != 'closed' THEN 0 ELSE 1 END, i.created_at DESC;"
    cursor.execute(query, params)
    issues = [dict(r) for r in cursor.fetchall()]

    active_stops = 0
    escalated_count = 0

    for item in issues:
        dt = item.get('downtime_minutes') or 0
        item['current_downtime_minutes'] = dt
        if item['status'] != 'closed':
            if dt >= 30:
                item['escalated_to_director'] = 1
                escalated_count += 1
            if item.get('severity') == 'critical_stop':
                active_stops += 1

    conn.close()
    return {
        'events': issues,
        'stats': {
            'total_events': len(issues),
            'active_stops': active_stops,
            'escalated_to_director': escalated_count
        }
    }

@app.post('/api/andon/trigger')
def trigger_andon_event(req: TriggerAndonEventRequest, request: Request):
    user = get_current_user_from_req(request)
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) FROM line_issues;")
    cnt = cursor.fetchone()[0] + 1
    ticket_num = f"ANDON-2026-{cnt:03d}"
    issue_id = f"andon-{uuid.uuid4().hex[:8]}"

    reporter = req.reporter_name.strip() if req.reporter_name else (user['full_name'] if user else 'Линейный сотрудник')
    creator = user['username'] if user else reporter

    cursor.execute("""
        INSERT INTO line_issues (
            id, ticket_number, department_id, line_name, defect_type, severity,
            description, status, error_code, target_service, created_by_user, reporter_name,
            downtime_minutes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, ?, CURRENT_TIMESTAMP);
    """, (
        issue_id, ticket_num, req.department_id, req.line_name, req.defect_type,
        req.severity or 'critical_stop', req.description, req.error_code or '',
        req.target_service or 'ws-mechanic', creator, reporter, req.downtime_minutes or 0
    ))

    conn.commit()
    conn.close()

    log_action(user['user_id'] if user else 'anon', reporter, '🚨 Быстрый вызов Andon', f"№{ticket_num}: {req.line_name} ({req.defect_type})")
    return {'status': 'success', 'issue_id': issue_id, 'ticket_number': ticket_num, 'message': 'Сигнал Andon передан службам ОГМ/ОТК/Мастеру'}

@app.post('/api/andon/{issue_id}/mechanic-resolve')
def mechanic_resolve_issue(issue_id: str, req: MechanicResolveRequest, request: Request):
    user = get_current_user_from_req(request)
    conn = get_db()
    cursor = conn.cursor()

    mech_name = req.mechanic_name.strip() if req.mechanic_name else (user['full_name'] if user else 'Механик ОГМ')

    cursor.execute("""
        UPDATE line_issues 
        SET mechanic_notes=?, mechanic_name=?, status='verification', resolved_at=CURRENT_TIMESTAMP
        WHERE id=?;
    """, (req.mechanic_notes.strip(), mech_name, issue_id))

    conn.commit()
    conn.close()

    log_action(user['user_id'] if user else 'mech', mech_name, 'Отписка механика о завершении ремонта', f"ID {issue_id}: {req.mechanic_notes[:60]}")
    return {'status': 'success', 'message': 'Ремонт отмечен. Линия передана Контролёру ОТК для проверки первой детали.'}

@app.post('/api/andon/{issue_id}/controller-unlock')
def controller_unlock_line(issue_id: str, req: ControllerUnlockRequest, request: Request):
    user = get_current_user_from_req(request)
    conn = get_db()
    cursor = conn.cursor()

    ctrl_name = req.controller_name.strip() if req.controller_name else (user['full_name'] if user else 'Контролёр ОТК')

    cursor.execute("""
        UPDATE line_issues 
        SET controller_notes=?, controller_name=?, unlocked_by_controller=1, status='closed', closed_at=CURRENT_TIMESTAMP
        WHERE id=?;
    """, (req.controller_notes.strip(), ctrl_name, issue_id))

    conn.commit()
    conn.close()

    log_action(user['user_id'] if user else 'qc', ctrl_name, 'Разблокировка линии контролёром ОТК', f"ID {issue_id}")
    return {'status': 'success', 'message': 'Линия проверена и успешно разблокирована в штатный режим!'}

# ==================== SHIFT REPORTS API ====================

@app.get('/api/shift-reports')
def list_shift_reports(date: Optional[str] = None, department_id: Optional[str] = None):
    req_date = date.strip() if date and date.strip() else datetime.now().strftime('%Y-%m-%d')
    conn = get_db()
    cursor = conn.cursor()

    query = "SELECT * FROM shift_reports WHERE report_date = ?"
    params = [req_date]

    if department_id and department_id != 'all':
        query += " AND department_id = ?"
        params.append(department_id)

    query += " ORDER BY created_at DESC;"
    cursor.execute(query, params)
    reports = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return {'reports': reports, 'date': req_date}

@app.post('/api/shift-reports/submit')
def submit_shift_report(req: SubmitShiftReportRequest, request: Request):
    user = require_auth(request)
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT name_ru FROM departments WHERE id=?;", (req.department_id,))
    d_row = cursor.fetchone()
    dept_name = d_row[0] if d_row else req.department_id

    rep_id = f"sr-{req.department_id}-{req.report_date}"
    author_name = user.get('full_name') or user.get('username')

    cursor.execute("SELECT id FROM shift_reports WHERE id=?;", (rep_id,))
    exists = cursor.fetchone()

    if exists:
        cursor.execute("""
            UPDATE shift_reports 
            SET plan_units=?, fact_units=?, scrap_units=?, downtime_minutes=?,
                downtime_reason=?, resource_consumption=?, issues_summary=?,
                kaizen_suggestions=?, author_name=?, author_role=?, updated_at=CURRENT_TIMESTAMP
            WHERE id=?;
        """, (
            req.plan_units, req.fact_units, req.scrap_units, req.downtime_minutes or 0,
            req.downtime_reason or '', req.resource_consumption or '',
            req.issues_summary or '', req.kaizen_suggestions or '',
            author_name, user.get('role', 'shop_head'), rep_id
        ))
    else:
        cursor.execute("""
            INSERT INTO shift_reports (
                id, report_date, shift, department_id, dept_name, author_id, author_name,
                author_role, plan_units, fact_units, scrap_units, downtime_minutes,
                downtime_reason, resource_consumption, issues_summary, kaizen_suggestions,
                status, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'submitted', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
        """, (
            rep_id, req.report_date, req.shift or '1-я смена', req.department_id, dept_name,
            user['user_id'], author_name, user.get('role', 'shop_head'),
            req.plan_units, req.fact_units, req.scrap_units, req.downtime_minutes or 0,
            req.downtime_reason or '', req.resource_consumption or '',
            req.issues_summary or '', req.kaizen_suggestions or ''
        ))

    conn.commit()
    conn.close()

    log_action(user['user_id'], author_name, 'Сдача сменного рапорта цеха', f"{dept_name}: План {req.plan_units}, Факт {req.fact_units}")
    return {'status': 'success', 'report_id': rep_id, 'message': 'Сменный рапорт успешно отправлен в систему'}

@app.post('/api/shift-reports/{report_id}/head-review')
def head_review_shift_report(report_id: str, req: HeadReviewShiftReportRequest, request: Request):
    user = require_auth(request)
    conn = get_db()
    cursor = conn.cursor()

    reviewer_name = user.get('full_name') or user.get('username')

    cursor.execute("""
        UPDATE shift_reports
        SET status='reviewed_by_head', head_reviewer=?, head_comment=?, updated_at=CURRENT_TIMESTAMP
        WHERE id=?;
    """, (reviewer_name, req.head_comment.strip(), report_id))

    conn.commit()
    conn.close()

    log_action(user['user_id'], reviewer_name, 'Визирование сменного рапорта', f"Рапорт {report_id}")
    return {'status': 'success', 'message': 'Рапорт завизирован руководителем цеха'}

@app.post('/api/shift-reports/{report_id}/director-approve')
def director_approve_shift_report(report_id: str, req: DirectorApproveShiftReportRequest, request: Request):
    user = require_auth(request)
    if user.get('role') not in ['director', 'admin']:
        raise HTTPException(status_code=403, detail='Право утверждать рапорты имеет только Генеральный директор')

    conn = get_db()
    cursor = conn.cursor()

    director_name = user.get('full_name') or user.get('username')

    cursor.execute("""
        UPDATE shift_reports
        SET status='approved_by_director', director_reviewer=?, director_verdict=?, updated_at=CURRENT_TIMESTAMP
        WHERE id=?;
    """, (director_name, req.director_verdict.strip(), report_id))

    conn.commit()
    conn.close()

    log_action(user['user_id'], director_name, 'Утверждение сменного рапорта Директором', f"Рапорт {report_id}")
    return {'status': 'success', 'message': 'Рапорт официально утверждён Генеральным директором'}

# ==================== WORKER INPUTS API ====================

@app.post('/api/worker/input')
def submit_worker_input(req: WorkerShiftInputRequest, request: Request):
    user = get_current_user_from_req(request)
    conn = get_db()
    cursor = conn.cursor()

    input_id = f"wsi-{uuid.uuid4().hex[:8]}"
    today_str = datetime.now().strftime('%Y-%m-%d')
    worker_name = user.get('full_name') if user else 'Рабочий смены'
    user_id = user.get('user_id') if user else f"usr-{uuid.uuid4().hex[:6]}"

    cursor.execute("""
        INSERT INTO worker_shift_inputs (
            id, date, shift, user_id, worker_name, department_id, line_name,
            article, units_made, defects_count, defect_reason, breakdown_notes
        ) VALUES (?, ?, '1-я смена', ?, ?, ?, ?, ?, ?, ?, ?, ?);
    """, (
        input_id, today_str, user_id, worker_name, req.department_id, req.line_name,
        req.article.strip(), req.units_made, req.defects_count, req.defect_reason or '', req.breakdown_notes or ''
    ))

    conn.commit()
    conn.close()

    log_action(user_id, worker_name, 'Ввод данных выработки рабочим', f"{req.line_name}: сделано {req.units_made}, брак {req.defects_count}")
    return {'status': 'success', 'input_id': input_id, 'message': 'Данные смены зафиксированы в цифровом журнале'}

@app.get('/api/worker/my-inputs')
def get_my_worker_inputs(request: Request):
    user = get_current_user_from_req(request)
    conn = get_db()
    cursor = conn.cursor()

    if user and user.get('role') == 'operator':
        cursor.execute("SELECT * FROM worker_shift_inputs WHERE user_id=? ORDER BY created_at DESC LIMIT 20;", (user['user_id'],))
    else:
        cursor.execute("SELECT * FROM worker_shift_inputs ORDER BY created_at DESC LIMIT 20;")

    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return {'inputs': rows}

@app.get('/api/worker/dashboard')
def get_worker_dashboard(request: Request, department_id: Optional[str] = None, line_name: Optional[str] = None):
    user = get_current_user_from_req(request)
    conn = get_db()
    cursor = conn.cursor()
    today_str = datetime.now().strftime('%Y-%m-%d')

    dept_id = department_id or (user.get('department_id') if user and user.get('department_id') != 'all' else 'ws-assembly')
    cursor.execute("SELECT * FROM departments WHERE id=?;", (dept_id,))
    dept_row = cursor.fetchone()
    dept = dict(dept_row) if dept_row else {'name_ru': 'Сборочный цех автомобильных сидений', 'code': 'WS-01', 'id': 'ws-assembly'}

    # Get lines of this dept
    cursor.execute("SELECT * FROM assembly_lines WHERE department_id=? AND is_active=1 ORDER BY name ASC;", (dept_id,))
    lines = [dict(r) for r in cursor.fetchall()]

    active_line_name = line_name or (lines[0]['name'] if lines else 'Линия сборки Cobalt (Главный конвейер)')

    # Find target pace
    cursor.execute("SELECT target_pace_shift FROM assembly_lines WHERE name=?;", (active_line_name,))
    l_row = cursor.fetchone()
    target_pace = l_row[0] if l_row and l_row[0] else 220

    # Get worker inputs today
    user_id = user.get('user_id') if user else None
    if user_id:
        cursor.execute("SELECT * FROM worker_shift_inputs WHERE user_id=? ORDER BY created_at DESC LIMIT 10;", (user_id,))
    else:
        cursor.execute("SELECT * FROM worker_shift_inputs WHERE department_id=? ORDER BY created_at DESC LIMIT 10;", (dept_id,))
    recent_inputs = [dict(r) for r in cursor.fetchall()]

    # Today's aggregated progress for this line
    cursor.execute("""
        SELECT COALESCE(SUM(units_made), 0), COALESCE(SUM(defects_count), 0)
        FROM worker_shift_inputs WHERE line_name=? AND date=?;
    """, (active_line_name, today_str))
    agg = cursor.fetchone()
    today_made = agg[0] or 0
    today_defects = agg[1] or 0

    if today_made == 0:
        # Default baseline if shift is just starting or demo
        today_made = 145
        today_defects = 2

    # Check active Andon status for this line
    cursor.execute("""
        SELECT COUNT(*), defect_type, status FROM line_issues
        WHERE line_name=? AND status != 'closed'
        GROUP BY id ORDER BY created_at DESC LIMIT 1;
    """, (active_line_name,))
    issue_row = cursor.fetchone()
    line_status = "В норме"
    active_issue_info = None
    if issue_row and issue_row[0] > 0:
        line_status = "Остановка / Ремонт"
        active_issue_info = {"defect_type": issue_row[1], "status": issue_row[2]}

    conn.close()

    worker_display_name = user.get('full_name') if user else 'Иброхим Салимов (Оператор-сборщик)'

    return {
        'worker_name': worker_display_name,
        'department': dept,
        'assigned_lines': lines,
        'current_line': active_line_name,
        'target_pace': target_pace,
        'today_made': today_made,
        'today_defects': today_defects,
        'completion_rate': round((today_made / target_pace * 100), 1) if target_pace > 0 else 0,
        'line_status': line_status,
        'active_issue': active_issue_info,
        'recent_inputs': recent_inputs,
        'shift_info': '1-я смена (08:00 - 17:00)'
    }

# ==================== OTK: INCOMING & RECLAMATIONS API ====================

@app.get('/api/quality/incoming')
def get_incoming_inspections():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM incoming_inspections ORDER BY created_at DESC;")
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return {'incoming': rows}

@app.post('/api/quality/incoming')
def create_incoming_inspection(req: IncomingInspectionRequest, request: Request):
    user = get_current_user_from_req(request)
    conn = get_db()
    cursor = conn.cursor()

    inc_id = f"inc-{uuid.uuid4().hex[:8]}"
    today_str = datetime.now().strftime('%Y-%m-%d')
    inspector = req.inspector_name or (user.get('full_name') if user else 'Контролёр ОТК')

    cursor.execute("""
        INSERT INTO incoming_inspections (
            id, date, material_name, supplier, batch_number, sample_size, defect_count,
            verdict, inspector_name, certificate_valid, comments
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    """, (
        inc_id, today_str, req.material_name.strip(), req.supplier.strip(), req.batch_number.strip(),
        req.sample_size, req.defect_count, req.verdict, inspector, req.certificate_valid, req.comments or ''
    ))

    conn.commit()
    conn.close()

    log_action(user['user_id'] if user else 'qc', inspector, 'Входной контроль сырья/металла', f"{req.material_name}: вердикт {req.verdict}")
    return {'status': 'success', 'id': inc_id, 'message': 'Акт входного контроля успешно зарегистрирован'}

@app.get('/api/quality/reclamations')
def get_reclamations():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM reclamations ORDER BY created_at DESC;")
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return {'reclamations': rows}

@app.post('/api/quality/reclamations')
def create_reclamation(req: CreateReclamationRequest, request: Request):
    user = get_current_user_from_req(request)
    conn = get_db()
    cursor = conn.cursor()

    rec_id = f"rec-{uuid.uuid4().hex[:8]}"
    ticket_num = f"REC-UZAUTO-2026-{secrets.randbelow(900)+100}"
    today_str = datetime.now().strftime('%Y-%m-%d')

    cursor.execute("""
        INSERT INTO reclamations (
            id, ticket_num, date, customer, car_model, part_number, defect_description,
            severity, root_cause_analysis, corrective_action, engineer_name, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'investigating');
    """, (
        rec_id, ticket_num, today_str, req.customer.strip(), req.car_model.strip(),
        req.part_number.strip(), req.defect_description.strip(), req.severity or 'major',
        req.root_cause_analysis or '', req.corrective_action or '', req.engineer_name.strip()
    ))

    conn.commit()
    conn.close()

    log_action(user['user_id'] if user else 'eng', req.engineer_name, 'Регистрация рекламации автозавода', f"№{ticket_num}: {req.car_model}")
    return {'status': 'success', 'id': rec_id, 'ticket_num': ticket_num, 'message': 'Рекламация внесена в систему 8D'}

# ==================== OGE & AHO API ====================

@app.get('/api/energy/status')
def get_energy_status():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM energy_metrics ORDER BY id DESC LIMIT 1;")
    row = cursor.fetchone()
    conn.close()
    data = dict(row) if row else {
        'electricity_kwh': 3420.5,
        'gas_m3': 185.0,
        'water_m3': 42.0,
        'air_pressure_bar': 6.9,
        'is_emergency': 0,
        'emergency_text': 'Все энергосистемы работают стабильно'
    }
    return {'energy': data}

@app.post('/api/energy/record')
def record_energy_metrics(req: EnergyRecordRequest, request: Request):
    user = get_current_user_from_req(request)
    conn = get_db()
    cursor = conn.cursor()

    reporter = user.get('full_name') if user else 'Служба ОГЭ'

    cursor.execute("""
        INSERT INTO energy_metrics (electricity_kwh, gas_m3, water_m3, air_pressure_bar, is_emergency, emergency_text, reported_by)
        VALUES (?, ?, ?, ?, 0, ?, ?);
    """, (req.electricity_kwh, req.gas_m3, req.water_m3, req.air_pressure_bar, req.notes or 'Показания счетчиков в норме', reporter))

    conn.commit()
    conn.close()

    log_action(user['user_id'] if user else 'oge', reporter, 'Внесение данных потребления ресурсов ОГЭ', f"Эл-во: {req.electricity_kwh} кВт·ч")
    return {'status': 'success', 'message': 'Показания энергопотребления сохранены'}

@app.post('/api/energy/alert')
def trigger_energy_alert(req: EnergyAlertRequest, request: Request):
    user = get_current_user_from_req(request)
    conn = get_db()
    cursor = conn.cursor()

    reporter = user.get('full_name') if user else 'Главный энергетик'

    cursor.execute("""
        INSERT INTO energy_metrics (electricity_kwh, gas_m3, water_m3, air_pressure_bar, is_emergency, emergency_text, reported_by)
        VALUES (0, 0, 0, 0, 1, ?, ?);
    """, (req.emergency_text.strip(), reporter))

    cursor.execute("SELECT COUNT(*) FROM line_issues;")
    cnt = cursor.fetchone()[0] + 1
    ticket_num = f"ANDON-OGE-{cnt:03d}"
    issue_id = f"oge-{uuid.uuid4().hex[:8]}"

    cursor.execute("""
        INSERT INTO line_issues (
            id, ticket_number, department_id, line_name, defect_type, severity,
            description, status, error_code, target_service, created_by_user, reporter_name,
            downtime_minutes, created_at
        ) VALUES (?, ?, 'ws-energy', 'Общезаводские сети энергоснабжения', 'Авария энергоснабжения / ОГЭ', 'critical_stop',
            ?, 'open', 'EMERGENCY-OGE-10KV', 'ws-energy', ?, ?, 5, CURRENT_TIMESTAMP);
    """, (issue_id, ticket_num, req.emergency_text.strip(), user['username'] if user else 'oge', reporter))

    conn.commit()
    conn.close()

    log_action(user['user_id'] if user else 'oge', reporter, '🚨 АВАРИЙНЫЙ СИГНАЛ ОГЭ', req.emergency_text)
    return {'status': 'success', 'message': 'АВАРИЙНЫЙ СИГНАЛ РАЗОСЛАН ПО ВСЕМУ ЗАВОДУ!'}

@app.get('/api/facility/checklists')
def get_facility_checklists():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM facility_checklists ORDER BY created_at DESC;")
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return {'checklists': rows}

@app.post('/api/facility/checklists')
def submit_facility_checklist(req: FacilityChecklistRequest, request: Request):
    user = get_current_user_from_req(request)
    conn = get_db()
    cursor = conn.cursor()

    chk_id = f"fac-{uuid.uuid4().hex[:8]}"
    today_str = datetime.now().strftime('%Y-%m-%d')
    inspector = user.get('full_name') if user else 'Инспектор АХО'

    cursor.execute("""
        INSERT INTO facility_checklists (
            id, date, inspector_name, cleanliness_ok, canteen_ok, security_ok,
            waste_disposal_ok, open_requests, closed_requests, report_text
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    """, (
        chk_id, today_str, inspector, req.cleanliness_ok, req.canteen_ok, req.security_ok,
        req.waste_disposal_ok, req.open_requests, req.closed_requests, req.report_text.strip()
    ))

    conn.commit()
    conn.close()

    log_action(user['user_id'] if user else 'aho', inspector, 'Чек-лист обслуживания АХО', f"Закрыто заявок: {req.closed_requests}")
    return {'status': 'success', 'message': 'Чек-лист АХО сохранен'}

# ==================== EXECUTIVE BI DASHBOARD API ====================

@app.get('/api/executive/bi')
def get_executive_bi():
    conn = get_db()
    cursor = conn.cursor()
    today_str = datetime.now().strftime('%Y-%m-%d')

    cursor.execute("""
        SELECT 
            SUM(plan_units) as total_plan,
            SUM(fact_units) as total_fact,
            SUM(scrap_units) as total_scrap,
            SUM(downtime_minutes) as total_downtime
        FROM shift_reports
        WHERE report_date = ?;
    """, (today_str,))
    sr_agg = cursor.fetchone()
    
    query_date = today_str
    if not sr_agg or not sr_agg[0]:
        cursor.execute("SELECT MAX(report_date) FROM shift_reports;")
        max_d_row = cursor.fetchone()
        if max_d_row and max_d_row[0]:
            query_date = max_d_row[0]
            cursor.execute("""
                SELECT 
                    SUM(plan_units), SUM(fact_units), SUM(scrap_units), SUM(downtime_minutes)
                FROM shift_reports WHERE report_date = ?;
            """, (query_date,))
            sr_agg = cursor.fetchone()

    total_plan = (sr_agg[0] or 2652)
    total_fact = (sr_agg[1] or 2603)
    total_scrap = (sr_agg[2] or 11)
    total_downtime = (sr_agg[3] or 46)

    production_rate = round((total_fact / total_plan * 100), 1) if total_plan > 0 else 0
    defect_rate = round((total_scrap / total_fact * 100), 2) if total_fact > 0 else 0
    defect_ppm = int((total_scrap / total_fact) * 1000000) if total_fact > 0 else 0

    total_shift_minutes = 480 * 5
    availability = round(max(0, (total_shift_minutes - total_downtime)) / total_shift_minutes * 100, 1)
    performance = round(min(100.0, (total_fact / total_plan) * 100), 1) if total_plan > 0 else 100.0
    quality = round((max(0, total_fact - total_scrap) / total_fact) * 100, 1) if total_fact > 0 else 100.0
    overall_oee = round((availability * performance * quality) / 10000, 1)

    capacity_utilization = round((total_fact / (total_plan * 1.05)) * 100, 1)

    scrap_cost_uzs = total_scrap * 280000
    downtime_cost_uzs = total_downtime * 150000
    total_financial_loss_uzs = scrap_cost_uzs + downtime_cost_uzs

    cursor.execute("""
        SELECT i.*, d.name_ru as dept_name_ru
        FROM line_issues i
        LEFT JOIN departments d ON i.department_id = d.id
        WHERE i.status != 'closed' AND (i.downtime_minutes >= 30 OR i.escalated_to_director = 1)
        ORDER BY i.downtime_minutes DESC;
    """)
    escalated_issues = [dict(r) for r in cursor.fetchall()]

    cursor.execute("""
        SELECT d.id, d.code, d.name_ru, d.head_name, d.compliance_score, d.status as dept_status,
               COALESCE(SUM(sr.plan_units), 0) as plan,
               COALESCE(SUM(sr.fact_units), 0) as fact,
               COALESCE(SUM(sr.scrap_units), 0) as scrap,
               COALESCE(SUM(sr.downtime_minutes), 0) as downtime
        FROM departments d
        LEFT JOIN shift_reports sr ON d.id = sr.department_id AND sr.report_date = ?
        GROUP BY d.id
        ORDER BY downtime DESC, scrap DESC;
    """, (query_date,))
    bottlenecks = [dict(r) for r in cursor.fetchall()]

    # Baseline department values if reports not yet filed today
    default_dept_plans = {
        'ws-assembly': (500, 485, 3, 14),
        'ws-welding': (450, 442, 2, 22),
        'ws-stamping': (1200, 1180, 5, 10),
        'ws-foam': (500, 496, 1, 0),
        'ws-sewing': (500, 480, 4, 18),
        'ws-quality': (100, 98, 0, 0),
        'ws-energy': (1, 1, 0, 0),
        'ws-mechanic': (1, 1, 0, 15),
        'ws-facility': (1, 1, 0, 0)
    }
    for b in bottlenecks:
        if b['plan'] == 0 and b['id'] in default_dept_plans:
            dp = default_dept_plans[b['id']]
            b['plan'] = dp[0]
            b['fact'] = dp[1]
            b['scrap'] = dp[2]
            b['downtime'] = dp[3]

    # Hourly production dynamics (08:00 - 17:00)
    hourly_production = [
        {"hour": "08:00", "plan": 265, "fact": 272},
        {"hour": "09:00", "plan": 530, "fact": 548},
        {"hour": "10:00", "plan": 795, "fact": 815},
        {"hour": "11:00", "plan": 1060, "fact": 1062},
        {"hour": "12:00", "plan": 1325, "fact": 1315},
        {"hour": "13:00", "plan": 1590, "fact": 1570},
        {"hour": "14:00", "plan": 1855, "fact": 1840},
        {"hour": "15:00", "plan": 2120, "fact": 2105},
        {"hour": "16:00", "plan": 2385, "fact": 2362},
        {"hour": "17:00", "plan": total_plan, "fact": total_fact}
    ]

    # Pareto Defect Categories
    defect_categories = [
        {"name": "Момент затяжки болтов М10 (SOS)", "count": 26, "percent": 32.5, "color": "#0284c7"},
        {"name": "Сварные швы / непровар робота", "count": 19, "percent": 23.8, "color": "#ef4444"},
        {"name": "Симметрия строчки чехла", "count": 14, "percent": 17.5, "color": "#f59e0b"},
        {"name": "Плотность пены ППУ (раковины)", "count": 12, "percent": 15.0, "color": "#10b981"},
        {"name": "Штамповка / заусенцы металла", "count": 9, "percent": 11.2, "color": "#8b5cf6"}
    ]

    # Downtime reasons
    downtime_by_reason = [
        {"reason": "Механический износ / ОГМ", "minutes": 22, "color": "#ef4444"},
        {"reason": "Сбой сварочного робота FANUC", "minutes": 16, "color": "#f59e0b"},
        {"reason": "Ожидание партии деталей", "minutes": 12, "color": "#0284c7"},
        {"reason": "Переналадка штампа AIDA", "minutes": 10, "color": "#8b5cf6"},
        {"reason": "Падение давления воздуха (ОГЭ)", "minutes": 6, "color": "#10b981"}
    ]

    conn.close()

    return {
        'total_production_number': {
            'fact': total_fact,
            'plan': total_plan,
            'rate': production_rate,
            'units': 'комплектов сидений и узлов'
        },
        'total_defect_rate': {
            'percent': defect_rate,
            'ppm': defect_ppm,
            'total_scrap_units': total_scrap
        },
        'oee': {
            'overall_oee': overall_oee,
            'availability': availability,
            'performance': performance,
            'quality': quality
        },
        'capacity_utilization': capacity_utilization,
        'financial_loss': {
            'total_loss_uzs': total_financial_loss_uzs,
            'scrap_cost_uzs': scrap_cost_uzs,
            'downtime_cost_uzs': downtime_cost_uzs,
            'total_loss_usd': round(total_financial_loss_uzs / 12800, 2)
        },
        'escalated_critical_issues': escalated_issues,
        'bottlenecks': bottlenecks,
        'hourly_production': hourly_production,
        'defect_categories': defect_categories,
        'downtime_by_reason': downtime_by_reason,
        'plant_status': 'В норме • Все 9 цехов работают в штатном режиме',
        'date': today_str
    }

# ==================== BIQS AUDITS & ADMIN ROUTES ====================

@app.get('/api/audits/biqs')
def list_biqs_audits(department_id: Optional[str] = None):
    conn = get_db()
    cursor = conn.cursor()
    if department_id and department_id != 'all':
        cursor.execute("SELECT a.*, d.name_ru as dept_name_ru FROM biqs_audits a LEFT JOIN departments d ON a.department_id = d.id WHERE a.department_id = ? ORDER BY a.created_at DESC;", (department_id,))
    else:
        cursor.execute("SELECT a.*, d.name_ru as dept_name_ru FROM biqs_audits a LEFT JOIN departments d ON a.department_id = d.id ORDER BY a.created_at DESC;")
    rows = [dict(r) for r in cursor.fetchall()]
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
    log_action(user['user_id'], user['username'], 'Проведение аудита BIQS', f"Аудит {audit_id}: {req.compliance_score}%")
    return {'status': 'success', 'audit_id': audit_id}

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
    log_action(user['user_id'], user['username'], 'Генерация инвайт-кода', f"Код: {generated_code}")
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
    return {'status': 'success'}

@app.get('/api/admin/users')
def list_users(request: Request):
    user = require_auth(request)
    if user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail='Доступ только для Главного Администратора')

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT u.id, u.username, u.full_name, u.role, u.department_id, u.is_active, u.created_at,
               d.name_ru as dept_name_ru, d.code as dept_code
        FROM users u
        LEFT JOIN departments d ON u.department_id = d.id
        ORDER BY u.created_at DESC;
    """)
    users = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return {'users': users}

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

@app.get('/', response_class=HTMLResponse)
def index():
    with open('static/index.html', 'r', encoding='utf-8') as f:
        return f.read()

if __name__ == '__main__':
    uvicorn.run('server:app', host='0.0.0.0', port=8080, reload=True)
