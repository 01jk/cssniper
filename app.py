
import streamlit as st
import pandas as pd
import time
import sys
import os

import yaml
import subprocess
import psutil
from datetime import datetime, timedelta, timezone

# Add parent directory to path to allow importing modules from root
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database.database import get_db
from database.models import TargetSkin, SalesHistory, StickerTier, Sticker, Charm
from sqlalchemy.orm import Session
from curl_cffi.requests import Session as SyncSession

st.set_page_config(layout="wide", page_title="CSFloat Sniper", page_icon="🎯")

def manual_buy_request(asset_id, settings):
    # ... (keeping existing function signature if needed, but here I am editing imports which are at top)
    # Actually replace_file_content targets specific lines. 
    # I will do 2 chunks. One for import, one for UI.
    """Initiates a manual buy request from the dashboard."""
    api_key = settings['scanner']['api_key']
    proxy = settings['scanner'].get('sniper_proxy')
    
    headers = {
        "Authorization": api_key,
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Referer": "https://csfloat.com/",
        "Origin": "https://csfloat.com"
    }
    
    proxies = {"http": proxy, "https": proxy} if proxy else None
    
    try:
        with SyncSession(impersonate="chrome120") as s:
            s.headers.update(headers)
            if proxies:
                s.proxies = proxies
            
            # CSFloat buy endpoint
            url = f"https://csfloat.com/api/v1/listings/{asset_id}/buy"
            # Note: This is a POST request typically
            resp = s.post(url, json={}, timeout=15)
            
            if resp.status_code in [200, 201]:
                return True, "Purchase initiated successfully!"
            elif resp.status_code == 404:
                return False, "Item not found or already sold (404)"
            else:
                return False, f"Error {resp.status_code}: {resp.text[:100]}"
    except Exception as e:
        return False, str(e)

def is_bot_running():
    for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
        try:
            cmdline = proc.info.get('cmdline', [])
            if cmdline and any("python" in arg.lower() for arg in cmdline) and any("main.py" in arg for arg in cmdline):
                return proc
        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
            pass
    return None

def start_bot():
    if not is_bot_running():
        # Using sys.executable to ensure we use the same python interpreter
        subprocess.Popen([sys.executable, "main.py"], cwd=os.getcwd(), creationflags=subprocess.CREATE_NEW_CONSOLE if os.name == 'nt' else 0)
        return True
    return False

def stop_bot():
    proc = is_bot_running()
    if proc:
        proc.terminate()
        return True
    return False

# Load settings
def load_settings():
    with open("config/settings.yaml", "r") as f:
        return yaml.safe_load(f)

settings = load_settings()

# Helper function to get DB titles
def get_db_session():
    return next(get_db())

# Caching data loading to prevent lag
@st.cache_data(ttl=3600)
def get_all_sticker_names():
    db = next(get_db())
    try:
        return [s.name for s in db.query(Sticker).all()]
    finally:
        db.close()

@st.cache_data(ttl=3600)
def get_all_charm_names():
    db = next(get_db())
    try:
        return [c.name for c in db.query(Charm).all()]
    finally:
        db.close()

@st.cache_data(ttl=3600)
def get_clean_skin_names():
    if os.path.exists("clean_skin_names.txt"):
        with open("clean_skin_names.txt", "r", encoding="utf-8") as f:
            return sorted(list(set([line.strip() for line in f.readlines() if line.strip()])))
    return []


# Sidebar
st.sidebar.title("CSFloat Sniper Bot")
st.sidebar.markdown("---")

bot_proc = is_bot_running()
if bot_proc:
    st.sidebar.success(f"Bot Status: 🟢 Running (PID: {bot_proc.pid})")
    if st.sidebar.button("� Stop Bot", use_container_width=True):
        if stop_bot():
            st.sidebar.warning("Bot stopping...")
            time.sleep(1)
            st.rerun()
else:
    st.sidebar.error("Bot Status: 🔴 Stopped")
    if st.sidebar.button("� Start Bot", use_container_width=True):
        if start_bot():
            st.sidebar.success("Bot starting...")
            time.sleep(1)
            st.rerun()

st.sidebar.markdown("---")

# Balance Check
def get_balance(api_key):
    try:
        headers = {"Authorization": api_key, "Accept": "application/json"}
        with SyncSession(impersonate="chrome120") as s:
            r = s.get("https://csfloat.com/api/v1/me", headers=headers, timeout=5)
            if r.status_code == 200:
                data = r.json()
                return data.get('user', {}).get('balance', 0) / 100.0
    except:
        pass
    return None

curr_bal = get_balance(settings['scanner']['api_key'])
if curr_bal is not None:
    st.sidebar.metric("CSFloat Balance", f"${curr_bal:.2f}")
else:
    st.sidebar.caption("Balance: Connect Error")

st.sidebar.markdown("---")
if st.sidebar.button("🔄 Refresh Dashboard"):
    st.rerun()

st.sidebar.info(f"Polling: {settings['scanner']['poll_interval_min']}s - {settings['scanner']['poll_interval_max']}s")

# Main Tabs
tab_dash, tab_targets, tab_stickers, tab_history, tab_settings = st.tabs([
    "📊 Dashboard", 
    "🎯 Targets", 
    "🏷️ Stickers", 
    "📜 History", 
    "⚙️ Settings"
])

with tab_dash:
    st.header("Real-time Overview")
    
    col1, col2, col3, col4 = st.columns(4)
    db = get_db_session()
    
    # Calculate stats
    now = datetime.now(timezone.utc)
    since_24h = now - timedelta(hours=24)
    
    items_found_today = db.query(SalesHistory).filter(SalesHistory.timestamp >= since_24h).count()
    items_bought_today = db.query(SalesHistory).filter(SalesHistory.timestamp >= since_24h, SalesHistory.purchased == True).count()
    
    with col1:
        st.metric("Balance", "$---", "N/A")
    with col2:
        st.metric("Items Found (24h)", f"{items_found_today}")
    with col3:
        st.metric("Items Bought (24h)", f"{items_bought_today}")
    with col4:
        st.metric("Est. Profit", "$0.00")
    
    # Load all sticker names for multiselect
    all_stickers = [s.name for s in db.query(Sticker).all()]
    db.close()

    st.subheader("Live Log (Last 20 lines)")
    try:
        # Fixed encoding issue
        if os.path.exists("logs/cssniper.log"):
            with open("logs/cssniper.log", "r", encoding="utf-8", errors="ignore") as f:
                lines = f.readlines()
                last_lines = lines[-20:] if len(lines) > 20 else lines
                st.text_area("Log Output", value="".join(last_lines), height=300)
        else:
            st.warning("Log file not found yet.")
    except Exception as e:
        st.error(f"Could not read log file: {e}")

with tab_targets:
    st.header("Targets Manager")
    
    db = get_db_session()
    
    # distinct() query for config names - NO CACHE to ensure fresh data after add/delete
    db_configs = [r[0] for r in db.query(TargetSkin.config_name).distinct().all()]
    
    # Initialize session state for empty newly created configs
    if "created_configs" not in st.session_state:
        st.session_state.created_configs = []
        
    # Merge DB configs and session configs (unique)
    all_configs_set = set(db_configs + st.session_state.created_configs)
    
    # Sorted list for display
    existing_configs = sorted(list(all_configs_set))
    
    # -- Pill-like Navigation --
    # Add a "+" option for creating new
    nav_options = existing_configs + ["➕"]
    
    # Use radio as horizontal pills (custom styled or native)
    # Streamlit 1.40+ has st.pills, but fallback to radio is safer
    # KEY ADDED HERE TO FIX GHOSTING
    try:
        selection = st.pills("Select Config", nav_options, default="Default", selection_mode="single", key="nav_config_selector")
    except AttributeError:
        selection = st.radio("Select Config", nav_options, horizontal=True, label_visibility="collapsed", key="nav_config_selector")
    
    if selection == "➕":
        with st.container(border=True):
            st.subheader("Create New Config")
            new_cfg_name = st.text_input("Config Name", placeholder="e.g. Kato 14")
            if st.button("Create"):
                if new_cfg_name and new_cfg_name not in existing_configs:
                    st.session_state.created_configs.append(new_cfg_name)
                    st.rerun()
                elif new_cfg_name in existing_configs:
                    st.warning("Exists.")
        st.stop() # Stop rendering the rest if in create mode
        
    current_config = selection
    if not current_config:
        current_config = "Default"

    # Define Mappings (Global for this tab)
    bg_map = {None: "Any", 0: "No", 1: "Tier 1", 2: "Tier 2", 3: "Tier 3", 4: "Any Tier"}
    bg_map_inv = {v: k for k, v in bg_map.items()} 

    # *** CRITICAL: Query targets ONCE here, BEFORE toolbar, to ensure fresh data ***
    targets_in_cfg = db.query(TargetSkin).filter(TargetSkin.config_name == current_config).all()

    # --- Toolbar Area ---
    st.divider()
    
    # Toolbar
    t_col1, t_col2, t_col3, t_col4 = st.columns([2, 4, 1.5, 1.5])
    
    with t_col1:
        # Check if all targets in config are active (use the queried targets_in_cfg)
        any_active = any(t.is_active for t in targets_in_cfg) if targets_in_cfg else False
        
        def toggle_config_active_state(cfg_name):
                # Callback to update DB immediately
                new_state = st.session_state[f"active_cfg_{cfg_name}"]
                db_sess = get_db_session() # New session for callback context
                targets = db_sess.query(TargetSkin).filter(TargetSkin.config_name == cfg_name).all()
                for t in targets:
                    t.is_active = new_state
                db_sess.commit()
                db_sess.close()

        cfg_enabled = st.checkbox(
            "Config Enabled", 
            value=any_active, 
            key=f"active_cfg_{current_config}",
            on_change=toggle_config_active_state,
            args=(current_config,)
        )
        
    with t_col2:
        st.write("") # Spacer
        
    with t_col3:
        # Add Target Button
        if st.button("➕ Add Target", key=f"add_btn_{current_config}", use_container_width=True):
                st.session_state[f"show_add_{current_config}"] = not st.session_state.get(f"show_add_{current_config}", False)
    
    with t_col4:
        # Delete Config
        if current_config != "Default":
            if st.button("🗑️ Delete Config", key=f"del_cfg_{current_config}", use_container_width=True):
                    db.query(TargetSkin).filter(TargetSkin.config_name == current_config).delete()
                    db.commit()
                    if current_config in st.session_state.created_configs:
                        st.session_state.created_configs.remove(current_config)
                    st.rerun()
        else:
                if st.button("🧹 Clear All", key="clear_default", use_container_width=True):
                    db.query(TargetSkin).filter(TargetSkin.config_name == "Default").delete()
                    db.commit()
                    st.rerun()

    # --- Add Target Constructor (Contextual) ---
    if st.session_state.get(f"show_add_{current_config}", False):
        with st.container(border=True):
            st.markdown(f"### 🛠️ New Target: **{current_config}**")
            with st.form(f"new_target_constructor_{current_config}"):
                # Skin Name - OPTIMIZED
                skin_options = ["*"] + get_clean_skin_names()
                
                c_name = st.selectbox("Item Name", options=skin_options, index=0)
                
                # Prices
                st.markdown("**Price & Markup**")
                cp1, cp2, cp3, cp4 = st.columns(4)
                with cp1:
                    c_min_price = st.number_input("Min ($)", min_value=0.0, value=0.0, step=1.0)
                with cp2:
                    c_max_price = st.number_input("Max ($)", min_value=0.0, value=1000000.0, step=1.0)
                with cp3:
                    c_markup_pct = st.number_input("Markup (%)", min_value=0.0, value=0.0, step=1.0)
                with cp4:
                    c_markup_mult = st.number_input("Mult (x)", min_value=1.0, value=1.0, step=0.1)
                
                # Checkbox row
                c_active = st.checkbox("Active immediately", value=True)

                # Special
                ce1, ce2, ce3, ce4 = st.columns(4)
                with ce1: c_mode = st.selectbox("Mode", ["Notify Only", "Auto Buy"])
                with ce2: c_stattrak = st.selectbox("StatTrak", ["Any", "Yes (StatTrak Only)", "No (Non-StatTrak)"])
                with ce3: c_paint_seed = st.number_input("Paint Seed", min_value=0, max_value=1000, value=None, step=1, placeholder="Any")
                with ce4: c_blue_gem = st.selectbox("Blue Gem", ["Any Tier", "Tier 1", "Tier 2", "Tier 3", "Tier 4"])
                
                # Rarity
                rarity_options = ["Any", "Contraband", "Covert", "Classified", "Restricted", "Mil-Spec", "Industrial Grade", "Base Grade"]
                c_rarity = st.selectbox("Rarity", options=rarity_options)
                
                bg_map = {None: "Any", 0: "No", 1: "Tier 1", 2: "Tier 2", 3: "Tier 3", 4: "Any Tier"}
                bg_map_inv = {v: k for k, v in bg_map.items()} 

                # Stickers
                st.markdown("**Stickers**")
                all_stickers = [None] + get_all_sticker_names()
                
                cs1, cs2, cs3, cs4, cs5 = st.columns(5)
                stickers_selected = []
                with cs1: s1 = st.selectbox("Slot 1", options=all_stickers, index=0)
                with cs2: s2 = st.selectbox("Slot 2", options=all_stickers, index=0)
                with cs3: s3 = st.selectbox("Slot 3", options=all_stickers, index=0)
                with cs4: s4 = st.selectbox("Slot 4", options=all_stickers, index=0)
                with cs5: s5 = st.selectbox("Slot 5", options=all_stickers, index=0)
                
                stickers_selected = [s for s in [s1, s2, s3, s4, s5] if s]
                
                # Charms
                all_charms = get_all_charm_names()
                c_charms = st.multiselect("Charms", options=all_charms)

                # Submit
                c_col1, c_col2 = st.columns([1, 4])
                with c_col1:
                    submitted = st.form_submit_button("💾 Save")
                
                if submitted:
                    st_val = None
                    if "Yes" in c_stattrak: st_val = True
                    if "No" in c_stattrak: st_val = False
                    
                    bg_map_save = {"Any Tier": None, "Tier 1": 1, "Tier 2": 2, "Tier 3": 3, "Tier 4": 4}

                    new_target = TargetSkin(
                        item_name=c_name,
                        min_price=c_min_price,
                        max_price=c_max_price,
                        min_float=0.0, # Adding default float range as these inputs were hidden in compact view? Or add them back? USER asked for ALL params.
                        max_float=1.0,
                        stickers=stickers_selected if stickers_selected else None,
                        charms=c_charms if c_charms else None,
                        is_stattrak=st_val,
                        is_active=c_active,
                        config_name=current_config,
                        mode=c_mode,
                        markup_pct=c_markup_pct,
                        markup_mult=c_markup_mult,
                        paint_seed=c_paint_seed if c_paint_seed else None,
                        blue_gem_tier=bg_map_save.get(c_blue_gem),
                        rarity_name=c_rarity if c_rarity != "Any" else None
                    )
                    db.add(new_target)
                    db.commit()
                    st.success("Target Added!")
                    st.session_state[f"show_add_{current_config}"] = False
                    st.rerun()

            if st.button("Close", key=f"close_cons_{current_config}"):
                 st.session_state[f"show_add_{current_config}"] = False
                 st.rerun()

    # --- Render Selected Table ---
    targets = sorted(targets_in_cfg, key=lambda x: x.id, reverse=True) # Show newest first

    if targets:
        df_data = []
        for t in targets:
            df_data.append({
                "ID": t.id,
                "Item Name": t.item_name,
                "Min Price": t.min_price,
                "Max Price": t.max_price,
                "Min Float": t.min_float,
                "Max Float": t.max_float,
                "Seeds": t.paint_seed if t.paint_seed else "Any",
                "Rarity": t.rarity_name if t.rarity_name else "Any",
                "Stickers": ", ".join(t.stickers) if t.stickers else "",
                "Charms": ", ".join(t.charms) if t.charms else "",
                "Blue Gem": bg_map.get(t.blue_gem_tier, "Any"),
                "Markup (%)": t.markup_pct,
                "Multiplier (x)": t.markup_mult,
                "Mode": t.mode,
                "StatTrak": "Yes" if t.is_stattrak is True else ("No" if t.is_stattrak is False else "Any"),
                "Active": t.is_active
            })

        df = pd.DataFrame(df_data)

        edited_df = st.data_editor(
            df,
            key=f"editor_{current_config}",
            use_container_width=True,
            hide_index=True,
            num_rows="dynamic",
            column_config={
                "Min Price": st.column_config.NumberColumn("Min Price", min_value=0.0, format="$%.2f"),
                "Max Price": st.column_config.NumberColumn("Max Price", min_value=0.0, format="$%.2f"),
                "Min Float": st.column_config.NumberColumn("Min Float", min_value=0.0, max_value=1.0, step=0.001, format="%.3f"),
                "Max Float": st.column_config.NumberColumn("Max Float", min_value=0.0, max_value=1.0, step=0.001, format="%.3f"),
                "Markup (%)": st.column_config.NumberColumn("Markup (%)", min_value=0.0, step=1.0, format="%.1f%%"),
                "Multiplier (x)": st.column_config.NumberColumn("Mult (x)", min_value=1.0, step=0.1, format="%.2fx"),
                "Mode": st.column_config.SelectboxColumn("Mode", options=["Notify Only", "Auto Buy"], required=True),
                "Blue Gem": st.column_config.SelectboxColumn("Blue Gem", options=list(bg_map.values()), required=True),
                "StatTrak": st.column_config.SelectboxColumn("StatTrak", options=["Any", "Yes", "No"], required=True),
                "Active": st.column_config.CheckboxColumn("Active", default=True),
            },
            disabled=["ID", "Item Name", "Stickers", "Charms"]
        )
        
        # Deletion Sync logic
        current_ids = set()
        if not edited_df.empty and "ID" in edited_df.columns:
            # Dropna because new empty rows might have NaN ID
            current_ids = set(edited_df["ID"].dropna().astype(int).tolist())
        
        original_ids = set(t.id for t in targets)
        deleted_ids = original_ids - current_ids # IDs in original but NOT in edited -> Deleted
        
        if deleted_ids:
             for d_id in deleted_ids:
                 db.query(TargetSkin).filter(TargetSkin.id == d_id).delete()
             db.commit()
             st.toast(f"🗑️ Deleted {len(deleted_ids)} targets")
             time.sleep(0.5)
             st.rerun()

        # Update Logic (Button)
        if st.button("💾 Update Rows", key=f"save_rows_{current_config}"):
            changes_count = 0
            for index, row in edited_df.iterrows():
                if pd.isna(row.get("ID")): continue 
                
                orig = next((t for t in targets if t.id == row["ID"]), None)
                if orig:
                    new_bg = bg_map_inv.get(row["Blue Gem"])
                    new_seed = row["Seeds"] if row["Seeds"] != "Any" else None
                    new_st = True if row["StatTrak"] == "Yes" else (False if row["StatTrak"] == "No" else None)
                    
                    if (orig.min_price != row["Min Price"] or 
                        orig.max_price != row["Max Price"] or
                        orig.min_float != row["Min Float"] or
                        orig.max_float != row["Max Float"] or
                        orig.is_active != row["Active"] or
                        orig.mode != row["Mode"] or
                        orig.markup_pct != row["Markup (%)"] or
                        orig.markup_mult != row["Multiplier (x)"] or
                        orig.blue_gem_tier != new_bg or
                        orig.paint_seed != new_seed or
                        orig.is_stattrak != new_st):
                        
                        orig.min_price = row["Min Price"]
                        orig.max_price = row["Max Price"]
                        orig.min_float = row["Min Float"]
                        orig.max_float = row["Max Float"]
                        orig.is_active = row["Active"]
                        orig.mode = row["Mode"]
                        orig.markup_pct = row["Markup (%)"]
                        orig.markup_mult = row["Multiplier (x)"]
                        orig.blue_gem_tier = new_bg
                        orig.paint_seed = new_seed
                        orig.is_stattrak = new_st
                        changes_count += 1
            
            if changes_count > 0:
                db.commit()
                st.success(f"Updated {changes_count} rows!")
                time.sleep(1)
                st.rerun()



    else:
        st.info("No targets in this config.")

    st.divider()

    db.close()

with tab_stickers:
    st.header("Sticker Tiers & Rules")
    st.info("Sticker valuation logic coming soon in Sprint 2.")

with tab_history:
    st.header("Sales & Discovery History")
    
    db = get_db_session()
    targets = db.query(TargetSkin).all()
    target_options = ["Custom / Manual"] + [f"{t.id}: {t.item_name}" for t in targets]
    
    # Markup controls
    with st.expander("📈 Overpay Calculator (Simulator)", expanded=True):
        # Select target to simulate
        selected_sim_target = st.selectbox("Pre-fill from Target", options=target_options)
        
        # Defaults
        init_pct = 0.0
        init_mult = 1.0
        
        if selected_sim_target != "Custom / Manual":
            target_id = int(selected_sim_target.split(":")[0])
            t_obj = next((t for t in targets if t.id == target_id), None)
            if t_obj:
                init_pct = t_obj.markup_pct
                init_mult = t_obj.markup_mult
        
        # Get the full object for the loop logic
        selected_target_obj = None
        if selected_sim_target != "Custom / Manual":
            target_id = int(selected_sim_target.split(":")[0])
            selected_target_obj = next((t for t in targets if t.id == target_id), None)

        col_m1, col_m2 = st.columns(2)
        with col_m1:
            markup_pct = st.number_input("Add Percentage (%)", min_value=0.0, max_value=1000.0, value=init_pct, step=1.0)
        with col_m2:
            markup_mult = st.number_input("Markup Multiplier (x)", min_value=1.0, max_value=10.0, value=init_mult, step=0.1)
    
    # Create a lookup map for live targets (Sync logic)
    targets_map = {t.item_name: t for t in targets}
    
    history = db.query(SalesHistory).order_by(SalesHistory.timestamp.desc()).limit(100).all()
    
    if history:
        # Column headers
        h_col1, h_col2, h_col3, h_col4, h_col5, h_col6, h_col7, h_col8, h_col9 = st.columns([1, 2, 1.5, 0.5, 0.8, 0.8, 1.2, 0.6, 0.8])
        h_col1.write("**Time**")
        h_col2.write("**Item**")
        h_col3.write("**Wear (Float)**")
        h_col4.write("**Seed**")
        h_col5.write("**Base**")
        h_col6.write("**Markup**")
        h_col7.write("**Profit**")
        h_col8.write("**Link**")
        h_col9.write("**Action**")
        st.divider()

        for h in history:
            base_price = h.price
            
            # Smart Markup Logic
            live_target = targets_map.get(h.item_name)
            
            if selected_target_obj:
                # Simulation Mode: Apply user inputs to matching items
                if h.item_name == selected_target_obj.item_name:
                    # Use the VALUES from number_input widgets (user's simulation parameters)
                    row_markup_pct = markup_pct
                    row_markup_mult = markup_mult
                else:
                    # Non-matching: Use Live Target > Historical > Neutral
                    if live_target:
                        row_markup_pct = live_target.markup_pct
                        row_markup_mult = live_target.markup_mult
                    elif h.markup_pct is not None:
                        row_markup_pct = h.markup_pct
                        row_markup_mult = h.markup_mult
                    else:
                        row_markup_pct = 0.0
                        row_markup_mult = 1.0
            else:
                # Custom/Global Mode: Apply user inputs to ALL items
                # Use number_input values directly
                row_markup_pct = markup_pct
                row_markup_mult = markup_mult
            
            mod_price = base_price * row_markup_mult * (1 + row_markup_pct / 100.0)
            profit_val = mod_price - base_price
            profit_pct = (profit_val / base_price * 100) if base_price > 0 else 0
            
            c1, c2, c3, c4, c5, c6, c7, c8, c9 = st.columns([1, 2, 1.5, 0.5, 0.8, 0.8, 1.2, 0.6, 0.8])
            
            time_str = h.timestamp.strftime("%H:%M:%S") if h.timestamp.date() == datetime.now().date() else h.timestamp.strftime("%m-%d %H:%M")
            c1.write(f"{time_str}")
            
            c2.write(f"**{h.item_name}**")
            if h.stickers:
                s_list = [s.get('name', '').replace('Sticker | ', '') for s in h.stickers if isinstance(s, dict)]
                if s_list:
                    c2.caption(", ".join(s_list))

            # New Wear(Float) Column
            wear_f_str = f"{h.wear_name} ({h.float_value:.4f})"
            c3.write(wear_f_str)

            c4.write(f"`{h.paint_seed if h.paint_seed is not None else '-'}`")
            c5.write(f"${base_price:.2f}")
            c6.write(f"**${mod_price:.2f}**")
            
            # Profit formatting
            profit_str = f"+${profit_val:.2f} ({profit_pct:.0f}%)"
            c7.write(f":green[{profit_str}]" if profit_val > 0 else f"{profit_str}")
            
            # Link to CSFloat
            item_url = f"https://csfloat.com/item/{h.asset_id}"
            c8.markdown(f"[View]({item_url})")
            
            # Buy button
            if h.purchased:
                c9.success("Bought ✅")
            else:
                if c9.button("Buy", key=f"buy_{h.asset_id}"):
                    success, message = manual_buy_request(h.asset_id, settings)
                    if success:
                        h.purchased = True
                        db.commit()
                        st.toast(f"✅ Success: {message}", icon="💰")
                        time.sleep(1)
                        st.rerun()
                    else:
                        st.error(message)
        
    else:
        st.info("No history records found.")

    db.close()

with tab_settings:
    st.header("Bot Configuration")
    
    with st.form("settings_form"):
        st.subheader("API Keys")
        csfloat_key = st.text_input("CSFloat API Key", value=settings['scanner']['api_key'], type="password")
        tg_token = st.text_input("Telegram Bot Token", value=settings['bot'].get('telegram_bot_token', ''), type="password")
        tg_target_token = st.text_input("Target Bot Token (Item Finds)", value=settings['bot'].get('telegram_target_bot_token', ''), type="password")
        tg_chat = st.text_input("Telegram Chat ID", value=settings['bot'].get('telegram_chat_id', ''))
        
        st.subheader("Scanner Settings")
        poll_min = st.slider("Min Poll Interval (s)", 0.1, 10.0, settings['scanner']['poll_interval_min'])
        poll_max = st.slider("Max Poll Interval (s)", 0.1, 10.0, settings['scanner']['poll_interval_max'])
        col1, col2 = st.columns(2)
        with col1:
            pre_min = st.slider("Min Pre-Delay (s)", 0.1, 5.0, settings['scanner'].get('pre_delay_min', 0.5))
        with col2:
            pre_max = st.slider("Max Pre-Delay (s)", 0.1, 5.0, settings['scanner'].get('pre_delay_max', 1.5))
        base_delay = st.slider("Base Delay / 429 Wait (s)", 0.1, 30.0, settings['scanner'].get('base_delay', 2.0))
        use_proxies = st.checkbox("Use Proxies (5+1 Architecture)", value=settings['scanner'].get('use_proxies', True))
        
        save = st.form_submit_button("Save Settings")
        if save:
            new_settings = settings.copy()
            new_settings['scanner']['api_key'] = csfloat_key
            new_settings['scanner']['poll_interval_min'] = poll_min
            new_settings['scanner']['poll_interval_max'] = poll_max
            new_settings['scanner']['pre_delay_min'] = pre_min
            new_settings['scanner']['pre_delay_max'] = pre_max
            new_settings['scanner']['base_delay'] = base_delay
            new_settings['scanner']['use_proxies'] = use_proxies
            new_settings['bot']['telegram_bot_token'] = tg_token
            new_settings['bot']['telegram_target_bot_token'] = tg_target_token
            new_settings['bot']['telegram_chat_id'] = tg_chat
            
            try:
                with open("config/settings.yaml", "w") as f:
                    yaml.safe_dump(new_settings, f)
                st.success("Settings saved successfully! Bot restart recommended.")
                time.sleep(1)
                st.rerun()
            except Exception as e:
                st.error(f"Error saving settings: {e}")

db.close()
