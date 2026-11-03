# ER diagram for SA-project chapter 4 (fig. 4.1), from the live schema (3 Nov 2026).
# Usage: python3 er_dot.py out.dot && dot -Tpng -Gdpi=150 out.dot -o er-diagram.png
import sys
T = {  # table: [(column, key)], key = PK | FK:table | UQ | ''
 "customers": [("customer_id","PK"),("auth_id","UQ"),("email","UQ"),("name",""),("phone","")],
 "users": [("user_id","PK"),("factory_id","FK:factories"),("auth_id","UQ"),("email","UQ"),("role","")],
 "factories": [("factory_id","PK"),("name",""),("is_active","")],
 "machine_models": [("model_id","PK"),("code","UQ"),("name",""),("price","")],
 "order_statuses": [("status_code","PK"),("name","")],
 "status_transitions": [("from_status","PK, FK:order_statuses"),("to_status","PK, FK:order_statuses")],
 "orders": [("order_id","PK"),("customer_id","FK:customers"),("model_id","FK:machine_models"),("factory_id","FK:factories"),("status","FK:order_statuses"),("order_code","UQ"),("quantity","")],
 "order_status_logs": [("log_id","PK"),("order_id","FK:orders"),("status","FK:order_statuses"),("changed_by","FK:users")],
 "quotations": [("quotation_id","PK"),("order_id","FK:orders"),("created_by","FK:users"),("total_price",""),("status","")],
 "quotation_items": [("item_id","PK"),("quotation_id","FK:quotations"),("amount","")],
 "payments": [("payment_id","PK"),("order_id","FK:orders"),("verified_by","FK:users"),("pay_type",""),("receipt_no","UQ")],
 "factory_assignments": [("assignment_id","PK"),("order_id","FK:orders"),("factory_id","FK:factories"),("sent_by","FK:users"),("response","")],
 "production_updates": [("update_id","PK"),("order_id","FK:orders"),("updated_by","FK:users"),("stage","")],
 "qc_items": [("item_id","PK"),("item_name",""),("is_active","")],
 "qc_results": [("qc_id","PK"),("order_id","FK:orders"),("factory_id","FK:factories"),("item_id","FK:qc_items"),("checked_by","FK:users"),("round_no",""),("stage",""),("passed","")],
 "qc_reviews": [("review_id","PK"),("order_id","FK:orders"),("reviewed_by","FK:users"),("round_no",""),("passed","")],
 "appointments": [("appointment_id","PK"),("order_id","FK:orders"),("created_by","FK:users"),("install_datetime",""),("status","")],
 "customer_reschedule_requests": [("request_id","PK"),("order_id","FK:orders"),("customer_id","FK:customers"),("appointment_id","FK:appointments"),("preferred_datetime",""),("status","")],
 "install_reschedule_requests": [("request_id","PK"),("order_id","FK:orders"),("appointment_id","FK:appointments"),("requested_by","FK:users"),("proposed_datetime",""),("status","")],
 "acceptance_checks": [("check_id","PK"),("order_id","FK:orders"),("passed",""),("forwarded_at","")],
 "notifications": [("notification_id","PK"),("order_id","FK:orders"),("recipient_type",""),("recipient_id","")],
 "shop_payment_details": [("id","PK"),("updated_by","FK:users"),("account_number",""),("qr_url","")],
 "business_rules": [("rule_key","PK"),("value","")],
}
# optional parent (nullable FK) -> child end drawn as zero-or-many from a zero-or-one parent
nullable = {("orders","model_id"),("orders","factory_id"),("users","factory_id"),("order_status_logs","changed_by"),("quotations","created_by"),
  ("payments","verified_by"),("factory_assignments","sent_by"),("production_updates","updated_by"),("qc_results","checked_by"),("qc_reviews","reviewed_by"),
  ("appointments","created_by"),("customer_reschedule_requests","appointment_id"),("install_reschedule_requests","appointment_id"),
  ("install_reschedule_requests","requested_by"),("notifications","order_id"),("shop_payment_details","updated_by")}
GROUP = {  # colour bands so related tables read together
 "people": ["customers","users","factories"], "catalog": ["machine_models","qc_items","business_rules","order_statuses","status_transitions"],
 "order": ["orders","order_status_logs","notifications"], "money": ["quotations","quotation_items","payments","shop_payment_details"],
 "make": ["factory_assignments","production_updates","qc_results","qc_reviews"],
 "install": ["appointments","customer_reschedule_requests","install_reschedule_requests","acceptance_checks"]}
FILL = {"people":"#e2f4f3","catalog":"#f1f3f2","order":"#fff4d6","money":"#fbe9e3","make":"#e6eefc","install":"#efe6fb"}
grp = {t:g for g,ts in GROUP.items() for t in ts}
out = ['digraph ER {', 'graph [rankdir=LR, splines=true, nodesep=0.35, ranksep=1.1, fontname="Helvetica", pad=0.3];',
       'node [shape=plain, fontname="Helvetica", fontsize=11];', 'edge [dir=both, color="#55606a", penwidth=1.1];']
for t, cols in T.items():
    def row(c, k):
        name = f"<b><u>{c}</u></b>" if "PK" in k else (f"<i>{c}</i>" if "FK" in k else c)
        key = f'<font color="#6b7680">{k.replace("FK:", "FK→")}</font>' if k else " "
        return f'<tr><td align="left" port="{c}">{name}</td><td align="left">{key}</td></tr>'
    rows = "".join(row(c, k) for c, k in cols)
    out.append(f'"{t}" [label=<<table border="1" cellborder="0" cellspacing="0" cellpadding="4" color="#7d8a95">'
               f'<tr><td colspan="2" bgcolor="{FILL[grp[t]]}"><b>{t}</b></td></tr>{rows}</table>>];')
for t, cols in T.items():
    for c, k in cols:
        for part in k.split(", "):
            if part.startswith("FK:"):
                p = part[3:]
                tail = "teeodot" if (t, c) in nullable else "teetee"   # parent side: zero-or-one / exactly one
                out.append(f'"{p}" -> "{t}":"{c}" [arrowtail={tail}, arrowhead=crowodot];')
out.append('}')
open(sys.argv[1], "w").write("\n".join(out))
