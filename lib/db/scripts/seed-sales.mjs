import pg from "pg";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const products = [
  ["PNL-540W-MONO", "540W Monocrystalline Solar Panel", "panel", "Tier-1 monocrystalline PERC panel, 540Wp, 25-year warranty", "nos", "11500", "12", "85414300", "Waaree", "540"],
  ["PNL-450W-POLY", "450W Polycrystalline Panel", "panel", null, "nos", "8800", "12", "85414300", "Adani Solar", "450"],
  ["INV-50KW-3PH", "50kW Three-Phase Grid-Tie Inverter", "inverter", "String inverter with 4 MPPTs, IP66, WiFi monitoring", "nos", "285000", "18", "85044090", "Sungrow", null],
  ["INV-10KW-1PH", "10kW Single-Phase Inverter", "inverter", null, "nos", "78000", "18", "85044090", "Microtek", null],
  ["INV-5KW-HYB", "5kW Hybrid Inverter (with battery support)", "inverter", null, "nos", "95000", "18", "85044090", "Luminous", null],
  ["STR-MS-1KWP", "Mounting Structure (HDG, per kWp)", "structure", "Hot-dip galvanized rooftop mounting structure", "kWp", "3200", "18", "73089090", "TATA Steel", null],
  ["STR-GROUND-1KWP", "Ground-Mount Structure (per kWp)", "structure", null, "kWp", "5500", "18", "73089090", null, null],
  ["BAT-10KWH-LFP", "10kWh LiFePO4 Battery Pack", "battery", null, "nos", "385000", "18", "85076000", "Exide", null],
  ["CBL-DC-4SQMM", "DC Solar Cable 4 sq mm (per metre)", "cable", null, "m", "65", "18", "85444900", null, null],
  ["CBL-AC-25SQMM", "AC Cable 25 sq mm (per metre)", "cable", null, "m", "320", "18", "85444900", null, null],
  ["INST-RES-1KWP", "Residential Installation & Commissioning (per kWp)", "installation", null, "kWp", "4500", "18", "998732", null, null],
  ["INST-COM-1KWP", "Commercial Installation & Commissioning (per kWp)", "installation", null, "kWp", "3800", "18", "998732", null, null],
  ["AMC-RES-1Y", "Annual Maintenance Contract (Residential, per kWp)", "amc", null, "kWp", "850", "18", "998719", null, null],
  ["AMC-COM-1Y", "Annual Maintenance Contract (Commercial, per kWp)", "amc", null, "kWp", "650", "18", "998719", null, null],
  ["ACC-NETMETER", "Net Meter Installation & Application", "accessory", null, "nos", "12500", "18", "902830", null, null],
  ["ACC-LIGHTNING", "Lightning Arrester Kit", "accessory", null, "nos", "8500", "18", "85362090", null, null],
];

const rules = [
  ["Sales Manager approval (₹2L–₹10L)", "quotation", "200000", "1000000", "admin", 1, true],
  ["Finance Head approval (₹10L–₹50L)", "quotation", "1000000", "5000000", "finance", 1, true],
  ["Director approval (above ₹50L)", "quotation", "5000000", null, "admin", 2, true],
];

async function main() {
  console.log("Seeding products...");
  for (const p of products) {
    await pool.query(
      `insert into products (sku, name, category, description, unit, unit_price, gst_rate, hsn_code, manufacturer, wattage)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) on conflict (sku) do nothing`,
      p,
    );
  }

  console.log("Seeding approval rules...");
  await pool.query("delete from approval_rules");
  for (const r of rules) {
    await pool.query(
      `insert into approval_rules (name, entity_type, min_amount, max_amount, approver_role, level, is_active)
       values ($1,$2,$3,$4,$5,$6,$7)`,
      r,
    );
  }

  console.log("Seeding sample quotations...");
  const existing = await pool.query("select count(*)::int as c from quotations");
  if (existing.rows[0].c > 0) {
    console.log("  quotations already exist, skipping");
    await pool.end();
    return;
  }
  const accts = (await pool.query("select id, name from accounts order by id limit 3")).rows;
  const lds = (await pool.query("select id, title from leads order by id limit 3")).rows;
  const cts = (await pool.query("select id from contacts order by id limit 3")).rows;
  const allProducts = (await pool.query("select id, sku, name, unit, unit_price, gst_rate from products")).rows;
  const byKey = (sku) => allProducts.find(p => p.sku === sku);

  const yr = new Date().getFullYear();
  const samples = [
    {
      number: `QT-${yr}-00001`, leadId: lds[0]?.id ?? null, accountId: accts[0]?.id ?? null, contactId: cts[0]?.id ?? null,
      title: "50kW Rooftop Solar — Tata Steel Plant (Jamshedpur)", status: "approved",
      validUntil: "2026-06-30",
      notes: "Includes net metering and 1-year AMC.",
      terms: "50% advance, 40% on material delivery, 10% on commissioning. Payment within 30 days.",
      discount: 25000,
      items: [
        ["PNL-540W-MONO", 93], ["INV-50KW-3PH", 1], ["STR-MS-1KWP", 50],
        ["CBL-DC-4SQMM", 400], ["CBL-AC-25SQMM", 80],
        ["INST-COM-1KWP", 50], ["ACC-NETMETER", 1], ["AMC-COM-1Y", 50],
      ],
    },
    {
      number: `QT-${yr}-00002`, leadId: lds[1]?.id ?? null, accountId: accts[1]?.id ?? accts[0]?.id ?? null, contactId: cts[1]?.id ?? null,
      title: "10kW Hybrid System — Apollo Hospital Annexe", status: "pending_approval",
      validUntil: "2026-05-31", notes: null, terms: null, discount: 0,
      items: [
        ["PNL-540W-MONO", 19], ["INV-5KW-HYB", 2], ["BAT-10KWH-LFP", 1],
        ["STR-MS-1KWP", 10], ["INST-COM-1KWP", 10],
      ],
    },
    {
      number: `QT-${yr}-00003`, leadId: lds[2]?.id ?? null, accountId: accts[2]?.id ?? accts[0]?.id ?? null, contactId: cts[2]?.id ?? null,
      title: "5kW Residential Rooftop — Pune", status: "draft",
      validUntil: "2026-05-15", notes: null, terms: null, discount: 5500,
      items: [
        ["PNL-540W-MONO", 10], ["INV-10KW-1PH", 1], ["STR-MS-1KWP", 5],
        ["INST-RES-1KWP", 5], ["ACC-NETMETER", 1],
      ],
    },
  ];

  for (const s of samples) {
    let subtotal = 0, gstTotal = 0;
    const lineRows = [];
    for (const [sku, qty] of s.items) {
      const p = byKey(sku);
      if (!p) continue;
      const lineTotal = +(qty * Number(p.unit_price)).toFixed(2);
      subtotal += lineTotal;
      gstTotal += lineTotal * (Number(p.gst_rate) / 100);
      lineRows.push({ p, qty, lineTotal });
    }
    const taxable = Math.max(0, subtotal - s.discount);
    const gst = subtotal > 0 ? +(taxable * (gstTotal / subtotal)).toFixed(2) : 0;
    const total = +(taxable + gst).toFixed(2);
    const { rows } = await pool.query(
      `insert into quotations (quotation_number, lead_id, account_id, contact_id, title, status, valid_until,
         subtotal, discount_amount, taxable_amount, gst_amount, total, notes, terms_and_conditions, created_by_id)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14, (select id from users where role='sales' limit 1))
       returning id`,
      [s.number, s.leadId, s.accountId, s.contactId, s.title, s.status, s.validUntil,
       subtotal.toFixed(2), s.discount.toFixed(2), taxable.toFixed(2), gst.toFixed(2), total.toFixed(2), s.notes, s.terms],
    );
    const qId = rows[0].id;
    let pos = 0;
    for (const lr of lineRows) {
      await pool.query(
        `insert into quotation_line_items (quotation_id, product_id, product_name, quantity, unit, unit_price, discount_pct, gst_rate, line_total, position)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [qId, lr.p.id, lr.p.name, lr.qty, lr.p.unit, lr.p.unit_price, "0", lr.p.gst_rate, lr.lineTotal.toFixed(2), pos++],
      );
    }
    if (s.status === "pending_approval") {
      const rules = await pool.query(
        `select * from approval_rules where entity_type='quotation' and is_active=true and min_amount <= $1 and (max_amount is null or max_amount >= $1) order by level`,
        [total],
      );
      for (const rule of rules.rows) {
        const approver = (await pool.query("select id from users where role=$1 limit 1", [rule.approver_role])).rows[0];
        await pool.query(
          `insert into approval_requests (entity_type, entity_id, amount, rule_id, approver_role, approver_id, level, status)
           values ('quotation', $1, $2, $3, $4, $5, $6, 'pending')`,
          [qId, total.toFixed(2), rule.id, rule.approver_role, approver?.id ?? null, rule.level],
        );
      }
    }
    console.log("  + quotation", s.number, "₹" + total.toLocaleString("en-IN"));
  }

  console.log("Seed complete.");
  await pool.end();
}

main().catch((e) => { console.error(e); pool.end(); process.exit(1); });
