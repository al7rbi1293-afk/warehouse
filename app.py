import streamlit as st
import pandas as pd
from datetime import datetime
import io
import uuid
import gspread
from oauth2client.service_account import ServiceAccountCredentials

# --- إعدادات الصفحة ---
st.set_page_config(page_title="WMS Cloud", layout="wide")

# --- القوائم للترجمة والربط ---
CATS_EN = ["Electrical", "Chemical", "Hand Tools", "Consumables", "Safety", "Others"]
CATS_AR = ["كهربائية", "كيميائية", "أدوات يدوية", "مستهلكات", "سلامة", "أخرى"]

def get_cat_key(selection):
    if selection in CATS_EN: return selection
    elif selection in CATS_AR: return CATS_EN[CATS_AR.index(selection)]
    return "Others"

# --- الترجمة (نفس السابق) ---
T = {
    "ar": {
        "app_title": "نظام إدارة المستودعات", "login_page": "تسجيل الدخول", "register_page": "تسجيل مشرف جديد",
        "username": "اسم المستخدم", "password": "كلمة المرور", "fullname": "الاسم الكامل", "region": "المنطقة",
        "login_btn": "دخول", "register_btn": "إنشاء حساب", "logout": "خروج", "profile": "الملف الشخصي",
        "home": "الرئيسية", "welcome": "مرحباً", "error_login": "بيانات خاطئة", "manager_role": "الإدارة",
        "supervisor_role": "مشرف", "add_item": "➕ إضافة مادة", "name_ar": "الاسم (عربي)", "name_en": "الاسم (English)",
        "category": "التصنيف", "qty": "الكمية", "cats": CATS_AR, "requests_log": "سجل الطلبات", "inventory": "المخزون",
        "req_form": "طلب صرف مواد", "select_item": "🔍 ابحث عن الأداة", "qty_req": "العدد المطلوب", "send_req": "إرسال الطلب",
        "download_excel": "تصدير Excel", "no_items": "المستودع فارغ", "pending_reqs": "⏳ طلبات بانتظار الموافقة",
        "approve": "✅ قبول", "reject": "❌ رفض", "status": "الحالة", "reason": "ملاحظات / سبب الرفض",
        "pending": "قيد الانتظار", "approved": "تم الصرف", "rejected": "مرفوض", "err_qty": "الكمية في المخزون غير كافية!",
        "err_reason": "يجب كتابة سبب الرفض", "write_reason": "اكتب سبب الرفض هنا..."
    },
    "en": {
        "app_title": "Warehouse System", "login_page": "Login", "register_page": "Register", "username": "Username",
        "password": "Password", "fullname": "Full Name", "region": "Region", "login_btn": "Login", "register_btn": "Sign Up",
        "logout": "Logout", "profile": "Profile", "home": "Home", "welcome": "Welcome", "error_login": "Invalid login",
        "manager_role": "Manager", "supervisor_role": "Supervisor", "add_item": "➕ Add Item", "name_ar": "Name (Ar)",
        "name_en": "Name (En)", "category": "Category", "qty": "Qty", "cats": CATS_EN, "requests_log": "Requests Log",
        "inventory": "Inventory", "req_form": "Request Form", "select_item": "🔍 Search Item", "qty_req": "Quantity",
        "send_req": "Submit", "download_excel": "Export Excel", "no_items": "Inventory Empty", "pending_reqs": "⏳ Pending Requests",
        "approve": "✅ Approve", "reject": "❌ Reject", "status": "Status", "reason": "Reason", "pending": "Pending",
        "approved": "Approved", "rejected": "Rejected", "err_qty": "Insufficient Stock!", "err_reason": "Reason required",
        "write_reason": "Write rejection reason..."
    }
}

lang_choice = st.sidebar.selectbox("Language / اللغة", ["العربية", "English"])
lang = "ar" if lang_choice == "العربية" else "en"
txt = T[lang]

if lang == "ar":
    st.markdown("<style>.stApp {direction: rtl; text-align: right;} .stDataFrame {direction: rtl;}</style>", unsafe_allow_html=True)
else:
    st.markdown("<style>.stApp {direction: ltr; text-align: left;}</style>", unsafe_allow_html=True)

# --- الاتصال بـ Google Sheets ---
# ملاحظة: سنقوم بضبط الأسرار (Secrets) في منصة Streamlit لاحقاً
def get_connection():
    scope = ['https://spreadsheets.google.com/feeds', 'https://www.googleapis.com/auth/drive']
    # جلب بيانات الاعتماد من أسرار Streamlit
    creds_dict = dict(st.secrets["gcp_service_account"])
    creds = ServiceAccountCredentials.from_json_keyfile_dict(creds_dict, scope)
    client = gspread.authorize(creds)
    # تأكد أن اسم الملف هنا يطابق اسم ملف جوجل شيت الذي أنشأته
    sheet = client.open("WMS_Database")
    return sheet

def load_data(worksheet_name):
    try:
        sh = get_connection()
        ws = sh.worksheet(worksheet_name)
        data = ws.get_all_records()
        df = pd.DataFrame(data)
        # تحويل الأرقام لنصوص لتجنب المشاكل ثم لأرقام
        if worksheet_name == 'users':
            df['username'] = df['username'].astype(str)
            df['password'] = df['password'].astype(str)
        return df
    except Exception as e:
        st.error(f"Error connecting to database: {e}")
        return pd.DataFrame()

def save_row(worksheet_name, row_data_list):
    sh = get_connection()
    ws = sh.worksheet(worksheet_name)
    ws.append_row(row_data_list)

def update_data(worksheet_name, df):
    # تحديث كامل للصفحة (يستخدم عند تعديل المخزون أو الحالة)
    sh = get_connection()
    ws = sh.worksheet(worksheet_name)
    ws.clear()
    # إعادة كتابة العناوين والبيانات
    ws.update([df.columns.values.tolist()] + df.values.tolist())

# --- إدارة الجلسة ---
if 'logged_in' not in st.session_state:
    st.session_state.logged_in = False
    st.session_state.user_info = {}

# === Login ===
if not st.session_state.logged_in:
    st.title(f"🔐 {txt['app_title']}")
    t1, t2 = st.tabs([txt['login_page'], txt['register_page']])
    with t1:
        with st.form("log"):
            u = st.text_input(txt['username']).strip()
            p = st.text_input(txt['password'], type="password").strip()
            if st.form_submit_button(txt['login_btn']):
                users = load_data('users')
                if not users.empty:
                    match = users[(users['username']==u) & (users['password']==p)]
                    if not match.empty:
                        st.session_state.logged_in = True
                        st.session_state.user_info = match.iloc[0].to_dict()
                        st.rerun()
                    else: st.error(txt['error_login'])
                else: st.error("Database connection error")
    with t2:
        with st.form("reg"):
            nu = st.text_input(txt['username'], key='r_u').strip()
            np = st.text_input(txt['password'], type='password', key='r_p').strip()
            nn = st.text_input(txt['fullname'])
            nr = st.text_input(txt['region'])
            if st.form_submit_button(txt['register_btn']):
                users = load_data('users')
                if nu not in users['username'].astype(str).values and nu:
                    # حفظ في جوجل شيت مباشرة
                    save_row('users', [nu, np, nn, 'supervisor', nr])
                    st.success(txt['success_reg'])
                else: st.error("Error or User exists")

# === App ===
else:
    info = st.session_state.user_info
    st.sidebar.markdown("---")
    st.sidebar.write(f"👤 {info['name']}")
    if st.sidebar.button(txt['logout']):
        st.session_state.logged_in = False
        st.rerun()

    # --- Manager ---
    if info['role'] == 'manager':
        st.header(f"👨‍💼 {txt['manager_role']}")
        inv = load_data('inventory')
        reqs = load_data('requests')

        # Pending Requests
        st.subheader(txt['pending_reqs'])
        pending_df = reqs[reqs['status'] == txt['pending']] if not reqs.empty else pd.DataFrame()
        
        if pending_df.empty:
            st.info("No pending requests")
        else:
            for index, row in pending_df.iterrows():
                with st.expander(f"{row['item_ar']} ({row['qty']}) - {row['supervisor']}", expanded=True):
                    c1, c2, c3 = st.columns([2,1,1])
                    c1.write(f"Qty: {row['qty']} | Region: {row['region']}")
                    
                    if c2.button(txt['approve'], key=f"app_{row['req_id']}"):
                        # Find item index in inventory
                        item_match = inv[inv['name_en'] == row['item_en']]
                        if not item_match.empty:
                            idx = item_match.index[0]
                            current_qty = int(inv.at[idx, 'qty'])
                            req_qty = int(row['qty'])
                            
                            if current_qty >= req_qty:
                                inv.at[idx, 'qty'] = current_qty - req_qty
                                # Update Requests DF locally then push
                                reqs.loc[reqs['req_id'] == row['req_id'], 'status'] = txt['approved']
                                
                                update_data('inventory', inv)
                                update_data('requests', reqs)
                                st.success("Approved & Updated")
                                st.rerun()
                            else: st.error(txt['err_qty'])
                        else: st.error("Item not found")

                    r_reason = c3.text_input(txt['write_reason'], key=f"rsn_{row['req_id']}")
                    if c3.button(txt['reject'], key=f"rej_{row['req_id']}"):
                        if r_reason:
                            reqs.loc[reqs['req_id'] == row['req_id'], 'status'] = txt['rejected']
                            reqs.loc[reqs['req_id'] == row['req_id'], 'reason'] = r_reason
                            update_data('requests', reqs)
                            st.warning("Rejected")
                            st.rerun()
                        else: st.error(txt['err_reason'])
        
        st.markdown("---")
        # Add Item
        with st.expander(txt['add_item']):
            c1, c2, c3 = st.columns(3)
            na = c1.text_input(txt['name_ar'])
            ne = c1.text_input(txt['name_en'])
            cat = c2.selectbox(txt['category'], txt['cats'])
            q = c3.number_input(txt['qty'], 1, 9999, 10)
            if st.button(txt['add_item']):
                if na:
                    save_row('inventory', [na, ne, get_cat_key(cat), q, 'Available'])
                    st.success("Added")
                    st.rerun()

        # Data View
        t1, t2 = st.tabs([txt['inventory'], txt['requests_log']])
        with t1:
            # للعرض فقط، التعديل المباشر معقد في جوجل شيت عبر التطبيق، يفضل التعديل من ملف الشيت مباشرة
            st.dataframe(inv, use_container_width=True)
            st.caption("لتعديل البيانات يدوياً، افتح ملف Google Sheets")
        with t2:
            st.dataframe(reqs, use_container_width=True)
            if not reqs.empty:
                b = io.BytesIO()
                with pd.ExcelWriter(b, engine='openpyxl') as w: reqs.to_excel(w, index=False)
                st.download_button(txt['download_excel'], b.getvalue(), "requests.xlsx")

    # --- Supervisor ---
    else:
        st.header(f"👷 {txt['req_form']}")
        inv = load_data('inventory')
        avail = inv[inv['status'] == 'Available'] if not inv.empty else pd.DataFrame()
        
        if avail.empty:
            st.warning(txt['no_items'])
        else:
            with st.form("req"):
                opts = avail.apply(lambda x: f"{x['name_ar']} | {x['name_en']}", axis=1)
                sel = st.selectbox(txt['select_item'], opts)
                qty = st.number_input(txt['qty_req'], 1, 1000, 1)
                if st.form_submit_button(txt['send_req']):
                    idx = opts[opts == sel].index[0]
                    item = avail.loc[idx]
                    save_row('requests', [
                        str(uuid.uuid4()), info['name'], info['region'],
                        item['name_ar'], item['name_en'], item['category'],
                        qty, datetime.now().strftime("%Y-%m-%d %H:%M"),
                        txt['pending'], ""
                    ])
                    st.success("Sent")

        st.markdown("---")
        st.subheader("My Requests")
        reqs = load_data('requests')
        if not reqs.empty:
            my_reqs = reqs[reqs['supervisor'] == info['name']]
            st.dataframe(my_reqs[['item_ar', 'qty', 'status', 'reason', 'date']], use_container_width=True)