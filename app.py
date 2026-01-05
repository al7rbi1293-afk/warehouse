import streamlit as st
import pandas as pd
from datetime import datetime
import io
import uuid
import time
import gspread
from oauth2client.service_account import ServiceAccountCredentials

# --- إعدادات الصفحة ---
st.set_page_config(page_title="WMS Secured", layout="wide", initial_sidebar_state="collapsed")

# --- القوائم للترجمة ---
CATS_EN = ["Electrical", "Chemical", "Hand Tools", "Consumables", "Safety", "Others"]
CATS_AR = ["كهربائية", "كيميائية", "أدوات يدوية", "مستهلكات", "سلامة", "أخرى"]
LOCATIONS = ["NTCC", "SNC"]

def get_cat_key(selection):
    if selection in CATS_EN: return selection
    elif selection in CATS_AR: return CATS_EN[CATS_AR.index(selection)]
    return "Others"

# --- الترجمة ---
T = {
    "ar": {
        "app_title": "نظام المستودعات (الداخلي/الخارجي)",
        "login_page": "دخول", "register_page": "تسجيل",
        "username": "المستخدم", "password": "كلمة المرور",
        "fullname": "الاسم", "region": "المنطقة",
        "login_btn": "دخول", "register_btn": "تسجيل جديد", "logout": "خروج",
        "manager_role": "الإدارة", "supervisor_role": "مشرف", "storekeeper_role": "أمين مستودع",
        "name_ar": "اسم عربي", "name_en": "اسم انجليزي", "category": "تصنيف",
        "qty": "الكمية", "cats": CATS_AR, "location": "المصدر",
        "requests_log": "سجل", "inventory": "المخزون",
        "local_inv": "جردي", "local_inv_mgr": "تقارير الفروع",
        "req_form": "طلب مواد", "select_item": "المادة",
        "current_local": "لديك:", "update_local": "تحديث",
        "qty_req": "مطلوب", "qty_local": "فعلي",
        "send_req": "إرسال", "update_btn": "حفظ",
        "download_excel": "Excel", "no_items": "لا يوجد مواد متاحة",
        "pending_reqs": "⏳ طلبات المشرفين", "approved_reqs": "📦 للصرف (مشرفين)",
        "approve": "قبول ✅", "reject": "رفض ❌", "issue": "صرف 📦",
        "status": "الحالة", "reason": "السبب",
        "pending": "انتظار", "approved": "معتمد", 
        "rejected": "مرفوض", "issued": "مصروف",
        "err_qty": "رصيد غير كاف!",
        "success_update": "تم التحديث",
        "success_req": "تم الإرسال",
        "success_issue": "تم الصرف",
        "filter_region": "منطقة",
        "issue_qty_input": "مصروف",
        "manage_stock": "⚙️ إدارة المخزون المركزي",
        "select_action": "إجراء",
        "add_stock": "إضافة (+)", "reduce_stock": "سحب (-)",
        "amount": "عدد",
        "current_stock_display": "رصيد:", "new_stock_display": "جديد:",
        "execute_update": "تحديث",
        "error_login": "خطأ بيانات", "success_reg": "تم التسجيل",
        "stock_take_central": "📝 جرد مركزي",
        "sk_request": "📥 طلب خاص (أمين المستودع)",
        "source_wh": "اختر المستودع",
        "ntcc_label": "داخلي (NTCC)", "snc_label": "خارجي (SNC)",
        "logs": "السجلات"
    },
    "en": {
        "app_title": "WMS System (Int/Ext)",
        "login_page": "Login", "register_page": "Register",
        "username": "Username", "password": "Password",
        "fullname": "Name", "region": "Region",
        "login_btn": "Login", "register_btn": "Sign Up", "logout": "Logout",
        "manager_role": "Manager", "supervisor_role": "Supervisor", "storekeeper_role": "Store Keeper",
        "name_ar": "Name (Ar)", "name_en": "Name (En)", "category": "Category",
        "qty": "Qty", "cats": CATS_EN, "location": "Source",
        "requests_log": "Log", "inventory": "Inventory",
        "local_inv": "My Stock", "local_inv_mgr": "Branch Reports",
        "req_form": "Request", "select_item": "Item",
        "current_local": "You have:", "update_local": "Update",
        "qty_req": "Request Qty", "qty_local": "Actual Qty",
        "send_req": "Send", "update_btn": "Save",
        "download_excel": "Excel", "no_items": "No items available",
        "pending_reqs": "⏳ Pending", "approved_reqs": "📦 To Issue",
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
        "manage_stock": "⚙️ Central Stock",
        "select_action": "Action",
        "add_stock": "Add (+)", "reduce_stock": "Remove (-)",
        "amount": "Amount",
        "current_stock_display": "Current:", "new_stock_display": "New:",
        "execute_update": "Update",
        "error_login": "Invalid", "success_reg": "Registered",
        "stock_take_central": "📝 Central Stock Take",
        "sk_request": "📥 Store Keeper Request",
        "source_wh": "Select Warehouse",
        "ntcc_label": "Internal (NTCC)", "snc_label": "External (SNC)",
        "logs": "Logs"
    }
}

lang_choice = st.sidebar.selectbox("Language / اللغة", ["العربية", "English"])
lang = "ar" if lang_choice == "العربية" else "en"
txt = T[lang]

# --- CSS للجوال ---
if lang == "ar":
    st.markdown("""
        <style>
        .stMarkdown, .stTextInput, .stNumberInput, .stSelectbox, .stDataFrame, .stRadio { direction: rtl; text-align: right; }
        [data-testid="stSidebarUserContent"] { direction: rtl; text-align: right; }
        .stButton button { width: 100%; }
        </style>
    """, unsafe_allow_html=True)
else:
    st.markdown("""<style>.stButton button { width: 100%; }</style>""", unsafe_allow_html=True)

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

def update_central_inventory_with_log(item_en, location, change_qty, user, action_desc):
    try:
        sh = get_connection()
        ws_inv = sh.worksheet('inventory')
        ws_log = sh.worksheet('stock_logs')
        inv_data = ws_inv.get_all_records()
        df_inv = pd.DataFrame(inv_data)
        
        mask = (df_inv['name_en'] == item_en) & (df_inv['location'] == location)
        
        if mask.any():
            idx = df_inv.index[mask][0]
            current_qty = int(df_inv.at[idx, 'qty'])
            new_qty = max(0, current_qty + change_qty)
            ws_inv.update_cell(idx + 2, 4, new_qty) 
            log_entry = [datetime.now().strftime("%Y-%m-%d %H:%M"), user, action_desc, item_en, location, change_qty, new_qty]
            ws_log.append_row(log_entry)
            return True
        else: return False
    except: return False

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
                else: st.error("DB Error")
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
    st.sidebar.markdown(f"### 👤 {info['name']}")
    st.sidebar.caption(f"📍 {info['region']} | 🔑 {info['role']}")
    if st.sidebar.button(txt['logout'], use_container_width=True):
        st.session_state.logged_in = False
        st.rerun()

    # ================= 1. واجهة المدير (كاملة) =================
    if info['role'] == 'manager':
        st.header(txt['manager_role'])
        inv = load_data('inventory')
        reqs = load_data('requests')
        logs = load_data('stock_logs')

        # إدارة المخزون المركزي (SNC & NTCC)
        with st.expander(txt['manage_stock'], expanded=True):
            wh_type = st.radio(txt['source_wh'], ["NTCC", "SNC"], horizontal=True, key="mgr_wh_sel")
            
            # فلترة المواد حسب المستودع المختار
            wh_inv = inv[inv['location'] == wh_type] if 'location' in inv.columns else pd.DataFrame()
            
            if wh_inv.empty:
                st.warning(f"{txt['no_items']} - {wh_type}")
            else:
                item_options = wh_inv.apply(lambda x: f"{x['name_ar']}", axis=1)
                selected_item_mgr = st.selectbox(txt['select_item'], item_options, key="mgr_it_sel")
                
                sel_row = wh_inv[wh_inv['name_ar'] == selected_item_mgr].iloc[0]
                st.info(f"{txt['current_stock_display']} **{sel_row['qty']}**")
                
                c_act, c_val = st.columns(2)
                action_type = c_act.radio(txt['select_action'], [txt['add_stock'], txt['reduce_stock']], label_visibility="collapsed")
                adjust_qty = c_val.number_input(txt['amount'], 1, 10000, 1)
                
                if st.button(txt['execute_update'], use_container_width=True):
                    change = adjust_qty if action_type == txt['add_stock'] else -adjust_qty
                    if update_central_inventory_with_log(sel_row['name_en'], wh_type, change, info['name'], "Manager Adjust"):
                        st.success(txt['success_update'])
                        time.sleep(1)
                        st.rerun()

        st.markdown("---")
        st.subheader(txt['pending_reqs'])
        # الطلبات المعلقة (غالباً تأتي من المشرفين للمستودع الداخلي NTCC)
        pending_all = reqs[reqs['status'] == txt['pending']] if not reqs.empty else pd.DataFrame()
        
        if pending_all.empty:
            st.success("✅")
        else:
            regions = pending_all['region'].unique()
            for region in regions:
                with st.expander(f"📍 {region} ({len(pending_all[pending_all['region']==region])})", expanded=False):
                    region_reqs = pending_all[pending_all['region'] == region]
                    for index, row in region_reqs.iterrows():
                        with st.container(border=True):
                            st.markdown(f"**📦 {row['item_ar']}**")
                            st.caption(f"{txt['qty']}: {row['qty']} | {row['supervisor']}")
                            c1, c2 = st.columns(2)
                            if c1.button(txt['approve'], key=f"ap_{row['req_id']}", use_container_width=True):
                                reqs.loc[reqs['req_id'] == row['req_id'], 'status'] = txt['approved']
                                update_data('requests', reqs)
                                st.rerun()
                            if c2.button(txt['reject'], key=f"rj_{row['req_id']}", use_container_width=True):
                                reqs.loc[reqs['req_id'] == row['req_id'], 'status'] = txt['rejected']
                                update_data('requests', reqs)
                                st.rerun()
        
        st.markdown("---")
        with st.expander(txt['logs']):
            if not logs.empty: st.dataframe(logs, use_container_width=True)

    # ================= 2. واجهة أمين المستودع =================
    elif info['role'] == 'storekeeper':
        st.header(txt['storekeeper_role'])
        reqs = load_data('requests')
        inv = load_data('inventory')
        
        tab_issue, tab_req_sk, tab_stocktake = st.tabs([txt['approved_reqs'], txt['sk_request'], txt['stock_take_central']])
        
        # 1. صرف طلبات المشرفين (من NTCC حصراً لأن المشرف لا يرى غيره)
        with tab_issue:
            approved = reqs[reqs['status'] == txt['approved']] if not reqs.empty else pd.DataFrame()
            if approved.empty:
                st.info("✅")
            else:
                for index, row in approved.iterrows():
                    with st.container(border=True):
                        st.markdown(f"**📦 {row['item_ar']}**")
                        st.caption(f"📍 {row['region']} | مطلوب: **{row['qty']}**")
                        st.caption("يتم الصرف تلقائياً من المستودع الداخلي NTCC")
                        
                        issue_qty = st.number_input(txt['issue_qty_input'], 1, 9999, int(row['qty']), key=f"iq_{row['req_id']}")
                        
                        if st.button(txt['issue'], key=f"btn_is_{row['req_id']}", use_container_width=True):
                            # الخصم من NTCC
                            if update_central_inventory_with_log(row['item_en'], "NTCC", -issue_qty, info['name'], f"Issued to {row['region']}"):
                                reqs.loc[reqs['req_id'] == row['req_id'], 'status'] = txt['issued']
                                reqs.loc[reqs['req_id'] == row['req_id'], 'qty'] = issue_qty
                                update_data('requests', reqs)
                                # تحديث محلي
                                local_inv_df = load_data('local_inventory')
                                cur = 0
                                if not local_inv_df.empty:
                                    m = local_inv_df[(local_inv_df['region']==row['region']) & (local_inv_df['item_en']==row['item_en'])]
                                    if not m.empty: cur = int(m.iloc[0]['qty'])
                                update_local_inventory_record(row['region'], row['item_en'], row['item_ar'], cur + issue_qty)
                                st.success("OK")
                                time.sleep(1)
                                st.rerun()
                            else: st.error("رصيد NTCC غير كافٍ أو المادة غير موجودة")

        # 2. طلبات الستور كيبر (يطلب من SNC أو NTCC)
        with tab_req_sk:
            wh_source = st.selectbox(txt['source_wh'], ["NTCC", "SNC"], key="sk_src_sel")
            wh_inv = inv[inv['location'] == wh_source] if 'location' in inv.columns else pd.DataFrame()
            
            if wh_inv.empty:
                st.warning(txt['no_items'])
            else:
                opts = wh_inv.apply(lambda x: f"{x['name_ar']}", axis=1)
                sel_sk = st.selectbox(txt['select_item'], opts, key="sk_it_sel")
                qty_sk = st.number_input(txt['qty_req'], 1, 1000, 1, key="sk_q")
                
                if st.button(txt['send_req'], key="sk_snd", use_container_width=True):
                    # الستور كيبر يطلب، والطلب يذهب للمدير للموافقة
                    # سنميز الطلب بأنه من الستور كيبر
                    item_data = wh_inv[wh_inv['name_ar'] == sel_sk].iloc[0]
                    save_row('requests', [
                        str(uuid.uuid4()), info['name'], info['region'], # region here might be 'Main'
                        item_data['name_ar'], item_data['name_en'], item_data['category'],
                        qty_sk, datetime.now().strftime("%Y-%m-%d %H:%M"),
                        txt['pending'], f"Source: {wh_source}" # نخزن المصدر في الملاحظات مؤقتاً
                    ])
                    st.success("✅")

        # 3. جرد وتعديل المخزون (SNC & NTCC)
        with tab_stocktake:
            tgt_wh = st.radio("اختر المستودع للتعديل:", ["SNC", "NTCC"], horizontal=True, key="sk_tk_wh")
            tgt_inv = inv[inv['location'] == tgt_wh] if 'location' in inv.columns else pd.DataFrame()
            
            if not tgt_inv.empty:
                tk_item = st.selectbox(txt['select_item'], tgt_inv['name_ar'], key="tk_it")
                tk_row = tgt_inv[tgt_inv['name_ar'] == tk_item].iloc[0]
                st.info(f"الرصيد: {tk_row['qty']}")
                
                c_tk1, c_tk2 = st.columns(2)
                op_tk = c_tk1.radio("نوع التعديل", ["+", "-"], horizontal=True, label_visibility="collapsed")
                val_tk = c_tk2.number_input("قيمة التعديل", 1, 1000, 1)
                
                if st.button(txt['update_btn'], key="tk_save", use_container_width=True):
                    change = val_tk if op_tk == "+" else -val_tk
                    if update_central_inventory_with_log(tk_row['name_en'], tgt_wh, change, info['name'], "StoreKeeper Adjust"):
                        st.success("تم")
                        time.sleep(1)
                        st.rerun()

    # ================= 3. واجهة المشرف (محصور في NTCC فقط) =================
    else:
        t_req, t_inv = st.tabs([txt['req_form'], txt['local_inv']])
        inv = load_data('inventory')
        local_inv = load_data('local_inventory')
        
        # فلترة صارمة: المشرف يرى فقط NTCC
        ntcc_items = inv[(inv['status'] == 'Available') & (inv['location'] == 'NTCC')] if 'location' in inv.columns else pd.DataFrame()
        
        with t_req:
            if ntcc_items.empty:
                st.warning("المستودع الداخلي فارغ حالياً")
            else:
                with st.container(border=True):
                    opts = ntcc_items.apply(lambda x: f"{x['name_ar']}", axis=1)
                    sel = st.selectbox(txt['select_item'], opts)
                    qty = st.number_input(txt['qty_req'], 1, 1000, 1)
                    
                    if st.button(txt['send_req'], use_container_width=True):
                        idx = opts[opts == sel].index[0]
                        item = ntcc_items.loc[idx]
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
            reqs = load_data('requests')
            if not reqs.empty:
                my_reqs = reqs[reqs['supervisor'] == info['name']]
                st.dataframe(my_reqs[['item_ar', 'qty', 'status']], use_container_width=True)

        with t_inv:
            # (نفس كود الجرد المحلي السابق)
            if ntcc_items.empty:
                st.info(txt['no_items'])
            else:
                # نظهر له قائمة المواد ليعمل جرد لما لديه
                # هنا نظهر أسماء المواد الفريدة فقط من NTCC لأنه المصدر المعتمد
                items_list = []
                for idx, row in ntcc_items.iterrows():
                    current_qty = 0
                    if not local_inv.empty:
                        match = local_inv[(local_inv['region'] == info['region']) & (local_inv['item_en'] == row['name_en'])]
                        if not match.empty: current_qty = int(match.iloc[0]['qty'])
                    items_list.append({"name_ar": row['name_ar'], "name_en": row['name_en'], "current_qty": current_qty})
                
                selected_item_inv = st.selectbox(txt['select_item'], [f"{x['name_ar']}" for x in items_list], key="sel_inv")
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
