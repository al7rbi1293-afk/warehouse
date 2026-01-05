import streamlit as st
import pandas as pd
from datetime import datetime
import io
import uuid
import time
import gspread
from oauth2client.service_account import ServiceAccountCredentials

# --- إعدادات الصفحة (تحسينات العرض) ---
st.set_page_config(page_title="WMS Mobile Pro", layout="wide", initial_sidebar_state="collapsed")

# --- CSS مخصص لتحسين الظهور على الجوال ---
st.markdown("""
<style>
    /* جعل الأزرار تأخذ كامل العرض في الجوال لسهولة الضغط */
    .stButton > button {
        width: 100%;
        border-radius: 10px;
        height: 3em;
    }
    /* تحسين تباعد النصوص */
    .stMarkdown {
        text-align: right;
    }
    /* تنسيق البطاقات (Containers) */
    [data-testid="stVerticalBlock"] > [style*="flex-direction: column;"] > [data-testid="stVerticalBlock"] {
        background-color: transparent;
    }
    /* تحسين الجداول على الجوال */
    .stDataFrame {
        width: 100%;
    }
</style>
""", unsafe_allow_html=True)

# --- القوائم للترجمة ---
CATS_EN = ["Electrical", "Chemical", "Hand Tools", "Consumables", "Safety", "Others"]
CATS_AR = ["كهربائية", "كيميائية", "أدوات يدوية", "مستهلكات", "سلامة", "أخرى"]

def get_cat_key(selection):
    if selection in CATS_EN: return selection
    elif selection in CATS_AR: return CATS_EN[CATS_AR.index(selection)]
    return "Others"

# --- الترجمة ---
T = {
    "ar": {
        "app_title": "نظام المستودعات الذكي",
        "login_page": "دخول", "register_page": "تسجيل",
        "username": "اسم المستخدم", "password": "كلمة المرور",
        "fullname": "الاسم", "region": "المنطقة",
        "login_btn": "تسجيل الدخول", "register_btn": "إنشاء حساب", "logout": "تسجيل خروج",
        "manager_role": "الإدارة", "supervisor_role": "مشرف", "storekeeper_role": "أمين المستودع",
        "name_ar": "الاسم (عربي)", "name_en": "الاسم (English)", "category": "التصنيف",
        "qty": "الكمية", "cats": CATS_AR,
        "requests_log": "السجل", "inventory": "المخزون",
        "local_inv": "جردي", "local_inv_mgr": "تقارير الفروع",
        "req_form": "طلب",
        "select_item": "اختر المادة",
        "current_local": "لديك حالياً:",
        "update_local": "تحديث",
        "qty_req": "الكمية المطلوبة",
        "qty_local": "العدد الفعلي",
        "send_req": "إرسال", "update_btn": "حفظ",
        "download_excel": "Excel", "no_items": "فارغ",
        "pending_reqs": "⏳ طلبات جديدة",
        "approved_reqs": "📦 للصرف",
        "approve": "قبول ✅", "reject": "رفض ❌", "issue": "صرف 📦",
        "status": "الحالة", "reason": "السبب",
        "pending": "انتظار", "approved": "معتمد", 
        "rejected": "مرفوض", "issued": "مصروف",
        "err_qty": "الكمية غير كافية!",
        "success_update": "تم التحديث",
        "success_req": "تم الإرسال",
        "success_issue": "تم الصرف",
        "filter_region": "المنطقة",
        "issue_qty_input": "العدد المصروف",
        "manage_stock": "⚙️ إدارة المخزون",
        "select_action": "العملية",
        "add_stock": "إضافة (+)",
        "reduce_stock": "سحب (-)",
        "amount": "العدد",
        "current_stock_display": "الرصيد:",
        "new_stock_display": "بعد التحديث:",
        "execute_update": "تحديث الرصيد",
        "error_login": "خطأ في البيانات",
        "success_reg": "تم التسجيل"
    },
    "en": {
        "app_title": "WMS System",
        "login_page": "Login", "register_page": "Register",
        "username": "Username", "password": "Password",
        "fullname": "Name", "region": "Region",
        "login_btn": "Login", "register_btn": "Sign Up", "logout": "Logout",
        "manager_role": "Manager", "supervisor_role": "Supervisor", "storekeeper_role": "Store Keeper",
        "name_ar": "Name (Ar)", "name_en": "Name (En)", "category": "Category",
        "qty": "Qty", "cats": CATS_EN,
        "requests_log": "Log", "inventory": "Inventory",
        "local_inv": "My Stock", "local_inv_mgr": "Branch Reports",
        "req_form": "Request",
        "select_item": "Item",
        "current_local": "You have:",
        "update_local": "Update",
        "qty_req": "Qty Request",
        "qty_local": "Actual Qty",
        "send_req": "Send", "update_btn": "Save",
        "download_excel": "Excel", "no_items": "Empty",
        "pending_reqs": "⏳ Pending",
        "approved_reqs": "📦 To Issue",
        "approve": "Approve ✅", "reject": "Reject ❌", "issue": "Issue 📦",
        "status": "Status", "reason": "Reason",
        "pending": "Pending", "approved": "Approved", 
        "rejected": "Rejected", "issued": "Issued",
        "err_qty": "Low Stock!",
        "success_update": "Updated",
        "success_req": "Sent",
        "success_issue": "Issued",
        "filter_region": "Region",
        "issue_qty_input": "Issued Qty",
        "manage_stock": "⚙️ Manage Stock",
        "select_action": "Action",
        "add_stock": "Add (+)",
        "reduce_stock": "Remove (-)",
        "amount": "Amount",
        "current_stock_display": "Current:",
        "new_stock_display": "New:",
        "execute_update": "Update",
        "error_login": "Invalid",
        "success_reg": "Registered"
    }
}

lang_choice = st.sidebar.selectbox("Language / اللغة", ["العربية", "English"])
lang = "ar" if lang_choice == "العربية" else "en"
txt = T[lang]

# فرض اتجاه النص حسب اللغة
if lang == "ar":
    st.markdown("<style>.stApp {direction: rtl; text-align: right;} .stDataFrame {direction: rtl;}</style>", unsafe_allow_html=True)
else:
    st.markdown("<style>.stApp {direction: ltr; text-align: left;}</style>", unsafe_allow_html=True)

# --- الاتصال بـ Google Sheets ---
@st.cache_resource
def get_connection():
    try:
        scope = ['https://spreadsheets.google.com/feeds', 'https://www.googleapis.com/auth/drive']
        creds_dict = dict(st.secrets["gcp_service_account"])
        creds = ServiceAccountCredentials.from_json_keyfile_dict(creds_dict, scope)
        client = gspread.authorize(creds)
        sheet = client.open("WMS_Database")
        return sheet
    except: return None

def load_data(worksheet_name):
    try:
        sh = get_connection()
        ws = sh.worksheet(worksheet_name)
        data = ws.get_all_records()
        return pd.DataFrame(data)
    except: return pd.DataFrame()

def save_row(worksheet_name, row_data_list):
    sh = get_connection()
    ws = sh.worksheet(worksheet_name)
    ws.append_row(row_data_list)

def update_data(worksheet_name, df):
    sh = get_connection()
    ws = sh.worksheet(worksheet_name)
    ws.clear()
    ws.update([df.columns.values.tolist()] + df.values.tolist())

def update_local_inventory_record(region, item_en, item_ar, new_qty):
    try:
        sh = get_connection()
        ws = sh.worksheet('local_inventory')
        data = ws.get_all_records()
        df = pd.DataFrame(data)
        
        if not df.empty:
            mask = (df['region'] == region) & (df['item_en'] == item_en)
        else: mask = pd.Series([False])

        if mask.any():
            row_idx = df.index[mask][0]
            ws.update_cell(row_idx + 2, 4, int(new_qty))
            ws.update_cell(row_idx + 2, 5, datetime.now().strftime("%Y-%m-%d %H:%M"))
        else:
            ws.append_row([region, item_en, item_ar, int(new_qty), datetime.now().strftime("%Y-%m-%d %H:%M")])
        return True
    except: return False

# --- إدارة الجلسة ---
if 'logged_in' not in st.session_state:
    st.session_state.logged_in = False
    st.session_state.user_info = {}

# === تسجيل الدخول ===
if not st.session_state.logged_in:
    st.title(f"🔐 {txt['app_title']}")
    t1, t2 = st.tabs([txt['login_page'], txt['register_page']])
    with t1:
        with st.form("log"):
            u = st.text_input(txt['username']).strip()
            p = st.text_input(txt['password'], type="password").strip()
            if st.form_submit_button(txt['login_btn'], use_container_width=True):
                users = load_data('users')
                if not users.empty:
                    users['username'] = users['username'].astype(str)
                    users['password'] = users['password'].astype(str)
                    match = users[(users['username']==u) & (users['password']==p)]
                    if not match.empty:
                        st.session_state.logged_in = True
                        st.session_state.user_info = match.iloc[0].to_dict()
                        st.rerun()
                    else: st.error(txt['error_login'])
                else: st.error("Database Error")
    with t2:
        with st.form("reg"):
            nu = st.text_input(txt['username'], key='r_u').strip()
            np = st.text_input(txt['password'], type='password', key='r_p').strip()
            nn = st.text_input(txt['fullname'])
            nr = st.text_input(txt['region'])
            if st.form_submit_button(txt['register_btn'], use_container_width=True):
                users = load_data('users')
                exists = False
                if not users.empty:
                    if nu in users['username'].astype(str).values: exists = True
                if not exists and nu:
                    save_row('users', [nu, np, nn, 'supervisor', nr])
                    st.success(txt['success_reg'])
                else: st.error("Error")

# === النظام الرئيسي ===
else:
    info = st.session_state.user_info
    st.sidebar.write(f"👤 {info['name']}")
    st.sidebar.caption(f"📍 {info['region']}")
    if st.sidebar.button(txt['logout'], use_container_width=True):
        st.session_state.logged_in = False
        st.rerun()

    # ================= 1. واجهة المدير (Responsive) =================
    if info['role'] == 'manager':
        st.header(txt['manager_role'])
        reqs = load_data('requests')
        inv = load_data('inventory')
        
        # --- المخزون (تصميم بسيط للجوال) ---
        with st.expander(txt['manage_stock'], expanded=False):
            if inv.empty:
                st.warning(txt['no_items'])
            else:
                # استخدام عمودين فقط بدلاً من 3
                item_options = inv.apply(lambda x: f"{x['name_ar']}", axis=1)
                selected_item_mgr = st.selectbox(txt['select_item'], item_options)
                
                idx_mgr = item_options[item_options == selected_item_mgr].index[0]
                current_mgr_qty = int(inv.at[idx_mgr, 'qty'])
                
                st.info(f"{txt['current_stock_display']} **{current_mgr_qty}**")
                
                col_act, col_amt = st.columns(2)
                action_type = col_act.radio(txt['select_action'], [txt['add_stock'], txt['reduce_stock']], label_visibility="collapsed")
                adjust_qty = col_amt.number_input(txt['amount'], 1, 10000, 1)
                
                if st.button(txt['execute_update'], use_container_width=True):
                    if action_type == txt['add_stock']:
                        inv.at[idx_mgr, 'qty'] = current_mgr_qty + adjust_qty
                    else:
                        inv.at[idx_mgr, 'qty'] = max(0, current_mgr_qty - adjust_qty)
                    update_data('inventory', inv)
                    st.success(txt['success_update'])
                    time.sleep(1)
                    st.rerun()

        st.markdown("---")

        # --- الطلبات (تصميم البطاقات للجوال) ---
        st.subheader(txt['pending_reqs'])
        pending_all = reqs[reqs['status'] == txt['pending']] if not reqs.empty else pd.DataFrame()
        
        if pending_all.empty:
            st.success("✅ الكل مكتمل")
        else:
            regions = pending_all['region'].unique()
            for region in regions:
                with st.expander(f"📍 {region} ({len(pending_all[pending_all['region']==region])})", expanded=False):
                    region_reqs = pending_all[pending_all['region'] == region]
                    for index, row in region_reqs.iterrows():
                        # --- تصميم البطاقة ---
                        with st.container(border=True):
                            st.markdown(f"**📦 {row['item_ar']}**")
                            c_info1, c_info2 = st.columns(2)
                            c_info1.caption(f"العدد: {row['qty']}")
                            c_info2.caption(f"بواسطة: {row['supervisor']}")
                            
                            # أزرار الإجراءات
                            c_btn1, c_btn2 = st.columns(2)
                            if c_btn1.button(txt['approve'], key=f"app_{row['req_id']}", use_container_width=True):
                                reqs.loc[reqs['req_id'] == row['req_id'], 'status'] = txt['approved']
                                update_data('requests', reqs)
                                st.success("✅")
                                time.sleep(0.5)
                                st.rerun()
                            
                            if c_btn2.button(txt['reject'], key=f"rej_btn_{row['req_id']}", use_container_width=True):
                                st.session_state[f"show_reason_{row['req_id']}"] = True

                            # إظهار حقل الرفض فقط عند الضغط
                            if st.session_state.get(f"show_reason_{row['req_id']}"):
                                reason = st.text_input(txt['reason'], key=f"rsn_{row['req_id']}")
                                if st.button("تأكيد الرفض", key=f"conf_rej_{row['req_id']}", use_container_width=True):
                                    if reason:
                                        reqs.loc[reqs['req_id'] == row['req_id'], 'status'] = txt['rejected']
                                        reqs.loc[reqs['req_id'] == row['req_id'], 'reason'] = reason
                                        update_data('requests', reqs)
                                        st.rerun()
                                    else: st.warning("اكتب السبب")

        st.markdown("---")
        with st.expander(txt['local_inv_mgr']):
            local_data = load_data('local_inventory')
            if not local_data.empty:
                st.dataframe(local_data, use_container_width=True)

    # ================= 2. واجهة أمين المستودع (Responsive) =================
    elif info['role'] == 'storekeeper':
        st.header(txt['storekeeper_role'])
        reqs = load_data('requests')
        inv = load_data('inventory')
        approved_df = reqs[reqs['status'] == txt['approved']] if not reqs.empty else pd.DataFrame()
        
        if approved_df.empty:
            st.info("✅ لا يوجد صرف")
        else:
            for index, row in approved_df.iterrows():
                # تصميم البطاقة للصرف
                with st.container(border=True):
                    st.markdown(f"**📦 {row['item_ar']}**")
                    st.caption(f"📍 {row['region']} | المطلوب: **{row['qty']}**")
                    
                    issue_qty = st.number_input(txt['issue_qty_input'], 1, 9999, int(row['qty']), key=f"iss_q_{row['req_id']}")
                    
                    if st.button(txt['issue'], key=f"iss_btn_{row['req_id']}", use_container_width=True):
                        item_match = inv[inv['name_en'] == row['item_en']]
                        if not item_match.empty:
                            idx = item_match.index[0]
                            current_stock = int(inv.at[idx, 'qty'])
                            if current_stock >= issue_qty:
                                inv.at[idx, 'qty'] = current_stock - issue_qty
                                reqs.loc[reqs['req_id'] == row['req_id'], 'status'] = txt['issued']
                                reqs.loc[reqs['req_id'] == row['req_id'], 'qty'] = issue_qty
                                
                                local_inv_df = load_data('local_inventory')
                                current_local = 0
                                if not local_inv_df.empty:
                                    lm = local_inv_df[(local_inv_df['region'] == row['region']) & (local_inv_df['item_en'] == row['item_en'])]
                                    if not lm.empty: current_local = int(lm.iloc[0]['qty'])
                                
                                update_local_inventory_record(row['region'], row['item_en'], row['item_ar'], current_local + issue_qty)
                                update_data('inventory', inv)
                                update_data('requests', reqs)
                                st.success("تم ✅")
                                time.sleep(1)
                                st.rerun()
                            else: st.error(f"{txt['err_qty']} ({current_stock})")
                        else: st.error("غير موجود")

    # ================= 3. واجهة المشرف (Responsive) =================
    else:
        t_req, t_inv = st.tabs([txt['req_form'], txt['local_inv']])
        inv = load_data('inventory')
        local_inv = load_data('local_inventory')
        avail_items = inv[inv['status'] == 'Available'] if not inv.empty else pd.DataFrame()
        
        with t_req:
            if avail_items.empty:
                st.warning(txt['no_items'])
            else:
                # نموذج الطلب المبسط
                with st.container(border=True):
                    opts = avail_items.apply(lambda x: f"{x['name_ar']}", axis=1)
                    sel = st.selectbox(txt['select_item'], opts)
                    qty = st.number_input(txt['qty_req'], 1, 1000, 1)
                    
                    if st.button(txt['send_req'], use_container_width=True):
                        idx = opts[opts == sel].index[0]
                        item = avail_items.loc[idx]
                        save_row('requests', [
                            str(uuid.uuid4()), info['name'], info['region'],
                            item['name_ar'], item['name_en'], item['category'],
                            qty, datetime.now().strftime("%Y-%m-%d %H:%M"),
                            txt['pending'], ""
                        ])
                        st.success("✅")
                        time.sleep(1)
                        st.rerun()
            
            st.markdown("---")
            st.caption("حالة طلباتي:")
            reqs = load_data('requests')
            if not reqs.empty:
                my_reqs = reqs[reqs['supervisor'] == info['name']]
                # عرض البيانات كجدول بسيط للجوال
                st.dataframe(my_reqs[['item_ar', 'qty', 'status']], use_container_width=True)

        with t_inv:
            st.caption("تحديث الجرد:")
            if avail_items.empty:
                st.info("لا توجد مواد")
            else:
                items_list = []
                for idx, row in avail_items.iterrows():
                    current_qty = 0
                    if not local_inv.empty:
                        match = local_inv[(local_inv['region'] == info['region']) & (local_inv['item_en'] == row['name_en'])]
                        if not match.empty: current_qty = int(match.iloc[0]['qty'])
                    items_list.append({"name_ar": row['name_ar'], "name_en": row['name_en'], "current_qty": current_qty})
                
                selected_item_inv = st.selectbox("المادة:", [f"{x['name_ar']}" for x in items_list])
                selected_data = next((item for item in items_list if item["name_ar"] == selected_item_inv), None)
                
                if selected_data:
                    with st.container(border=True):
                        st.markdown(f"**{selected_data['name_ar']}**")
                        st.caption(f"{txt['current_local']} {selected_data['current_qty']}")
                        new_val = st.number_input(txt['qty_local'], 0, 9999, selected_data['current_qty'])
                        if st.button(txt['update_btn'], use_container_width=True):
                            update_local_inventory_record(info['region'], selected_data['name_en'], selected_data['name_ar'], new_val)
                            st.success("✅")
                            time.sleep(1)
                            st.rerun()
