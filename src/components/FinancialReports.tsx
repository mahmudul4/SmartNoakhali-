import React, { useMemo, useState } from "react";
import {
  HandCoins,
  TrendingUp,
  TrendingDown,
  Wallet,
  Calendar,
  Download,
  Printer,
  CheckCircle2,
  Clock,
  Filter,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
} from "lucide-react";
import {
  type DonationRow,
  type ExpenseRow,
  DONATION_CATEGORY_LABELS,
  EXPENSE_CATEGORY_LABELS,
  type DonationCategory,
  type ExpenseCategory,
} from "@/lib/cloud";

interface FinancialReportsProps {
  donations: DonationRow[];
  expenses: ExpenseRow[];
  logoUrl?: string;
}

const BENGALI_MONTHS = [
  "জানুয়ারি",
  "ফেব্রুয়ারি",
  "মার্চ",
  "এপ্রিল",
  "মে",
  "জুন",
  "জুলাই",
  "আগস্ট",
  "সেপ্টেম্বর",
  "অক্টোবর",
  "নভেম্বর",
  "ডিসেম্বর",
];

export function FinancialReports({ donations, expenses, logoUrl }: FinancialReportsProps) {
  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState<number>(currentDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(currentDate.getMonth()); // 0-11
  const [reportTab, setReportTab] = useState<"overview" | "monthly" | "categories">("overview");

  // Approved donations
  const approvedDonations = useMemo(
    () => donations.filter((d) => d.status === "approved"),
    [donations]
  );
  const pendingDonations = useMemo(
    () => donations.filter((d) => d.status === "pending"),
    [donations]
  );

  // Approved expenses
  const approvedExpenses = useMemo(
    () => expenses.filter((e) => e.status !== "rejected"),
    [expenses]
  );

  // Overall totals
  const totalDonations = useMemo(
    () => approvedDonations.reduce((sum, d) => sum + Number(d.amount || 0), 0),
    [approvedDonations]
  );
  const totalExpenses = useMemo(
    () => approvedExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0),
    [approvedExpenses]
  );
  const netBalance = totalDonations - totalExpenses;

  // Current month stats
  const currentMonthYear = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}`;
  const currentMonthDonations = useMemo(
    () =>
      approvedDonations
        .filter((d) => (d.created_at || "").startsWith(currentMonthYear))
        .reduce((sum, d) => sum + Number(d.amount || 0), 0),
    [approvedDonations, currentMonthYear]
  );
  const currentMonthExpenses = useMemo(
    () =>
      approvedExpenses
        .filter((e) => (e.expense_date || e.created_at || "").startsWith(currentMonthYear))
        .reduce((sum, e) => sum + Number(e.amount || 0), 0),
    [approvedExpenses, currentMonthYear]
  );
  const currentMonthNet = currentMonthDonations - currentMonthExpenses;

  // Filtered by selected Month/Year
  const filterPrefix = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}`;
  const monthlyDonations = useMemo(
    () => approvedDonations.filter((d) => (d.created_at || "").startsWith(filterPrefix)),
    [approvedDonations, filterPrefix]
  );
  const monthlyExpenses = useMemo(
    () =>
      approvedExpenses.filter((e) =>
        (e.expense_date || e.created_at || "").startsWith(filterPrefix)
      ),
    [approvedExpenses, filterPrefix]
  );

  const monthlyDonationsTotal = useMemo(
    () => monthlyDonations.reduce((sum, d) => sum + Number(d.amount || 0), 0),
    [monthlyDonations]
  );
  const monthlyExpensesTotal = useMemo(
    () => monthlyExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0),
    [monthlyExpenses]
  );
  const monthlyNet = monthlyDonationsTotal - monthlyExpensesTotal;

  // Category breakdown for Donations (Core & Humanitarian receiving categories)
  const donationCategoriesList: DonationCategory[] = [
    "general",
    "treatment",
    "education",
    "zakat",
    "orphans_helpless",
    "emergency_relief",
    "food_clothing",
    "individual_family",
    "religious_institution",
    "social_project",
  ];
  const donationCategoryBreakdown = useMemo(() => {
    return donationCategoriesList
      .map((catKey) => {
        const items = approvedDonations.filter((d) => (d.category || "general") === catKey);
        const total = items.reduce((s, i) => s + Number(i.amount || 0), 0);
        const percentage = totalDonations > 0 ? ((total / totalDonations) * 100).toFixed(1) : "0.0";
        return {
          key: catKey,
          label: DONATION_CATEGORY_LABELS[catKey] || catKey,
          count: items.length,
          total,
          percentage,
        };
      })
      .filter((item) => item.count > 0 || ["general", "treatment", "education", "zakat"].includes(item.key));
  }, [approvedDonations, totalDonations]);

  // Category breakdown for Expenses (6 humanitarian categories)
  const expenseCategoriesList: ExpenseCategory[] = [
    "orphans_helpless",
    "emergency_relief",
    "food_clothing",
    "individual_family",
    "religious_institution",
    "social_project",
  ];
  const expenseCategoryBreakdown = useMemo(() => {
    return expenseCategoriesList.map((catKey) => {
      const items = approvedExpenses.filter((e) => e.category === catKey);
      const total = items.reduce((s, i) => s + Number(i.amount || 0), 0);
      const percentage = totalExpenses > 0 ? ((total / totalExpenses) * 100).toFixed(1) : "0.0";
      return {
        key: catKey,
        label: EXPENSE_CATEGORY_LABELS[catKey],
        count: items.length,
        total,
        percentage,
      };
    });
  }, [approvedExpenses, totalExpenses]);

  // CSV Export
  const handleExportCSV = () => {
    const rows = [
      ["Type", "Date", "Title / Donor", "Category", "Payment Method", "TrxID", "Amount (BDT)", "Status"],
    ];

    monthlyDonations.forEach((d) => {
      const donorName = d.is_anonymous ? "গোপন দাতা (Anonymous)" : d.sender_name;
      rows.push([
        "Donation (Income)",
        d.created_at ? d.created_at.split("T")[0] : "",
        `"${donorName}"`,
        `"${d.category ? (DONATION_CATEGORY_LABELS[d.category] || d.category) : "সাধারণ অনুদান"}"`,
        d.method,
        `"${d.trx_id}"`,
        String(d.amount),
        d.status,
      ]);
    });

    monthlyExpenses.forEach((e) => {
      rows.push([
        "Relief / Expense",
        e.expense_date || (e.created_at ? e.created_at.split("T")[0] : ""),
        `"${e.title}"`,
        `"${e.category_label || EXPENSE_CATEGORY_LABELS[e.category] || "ব্যয়"}"`,
        "—",
        "—",
        String(e.amount),
        e.status,
      ]);
    });

    rows.push([]);
    rows.push(["Summary for", `${BENGALI_MONTHS[selectedMonth]} ${selectedYear}`]);
    rows.push(["Total Donations", "", "", "", "", "", String(monthlyDonationsTotal)]);
    rows.push(["Total Expenses", "", "", "", "", "", String(monthlyExpensesTotal)]);
    rows.push(["Net Balance", "", "", "", "", "", String(monthlyNet)]);

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + rows.map((r) => r.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `Smart_Noakhali_Financial_Report_${selectedYear}_${selectedMonth + 1}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print view
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Printable Report Header (Hidden in regular web UI, visible on print) */}
      <div className="hidden print:block text-black p-6 space-y-4">
        <div className="text-center border-b pb-4">
          <h1 className="text-2xl font-bold">স্মার্ট নোয়াখালী ওয়েলফেয়ার প্ল্যাটফর্ম</h1>
          <p className="text-sm text-gray-600">আর্থিক প্রতিবেদন ও মানবিক হিসাব বিবরণী</p>
          <p className="text-xs text-gray-500 mt-1">
            প্রতিবেদন সময়কাল: {BENGALI_MONTHS[selectedMonth]} {selectedYear}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-4 border p-3 rounded">
          <div>
            <span className="text-xs text-gray-500 block">মোট সংগৃহীত অনুদান</span>
            <span className="text-base font-bold text-green-700">৳{monthlyDonationsTotal.toLocaleString("bn-BD")}</span>
          </div>
          <div>
            <span className="text-xs text-gray-500 block">মোট মানবিক ব্যয়</span>
            <span className="text-base font-bold text-rose-700">৳{monthlyExpensesTotal.toLocaleString("bn-BD")}</span>
          </div>
          <div>
            <span className="text-xs text-gray-500 block">অবশিষ্ট তহবিল ব্যালেন্স</span>
            <span className="text-base font-bold text-blue-700">৳{monthlyNet.toLocaleString("bn-BD")}</span>
          </div>
        </div>

        <div className="mt-6">
          <h2 className="text-sm font-bold border-b pb-1 mb-2">অনুদানের বিস্তারিত তালিকা</h2>
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b bg-gray-100">
                <th className="py-1 px-2">তারিখ</th>
                <th className="py-1 px-2">দাতার নাম</th>
                <th className="py-1 px-2">বিভাগ</th>
                <th className="py-1 px-2">মাধ্যম ও TrxID</th>
                <th className="py-1 px-2 text-right">পরিমাণ (৳)</th>
              </tr>
            </thead>
            <tbody>
              {monthlyDonations.map((d) => (
                <tr key={d.id} className="border-b">
                  <td className="py-1 px-2">{d.created_at?.split("T")[0]}</td>
                  <td className="py-1 px-2">
                    {d.is_anonymous ? "গোপন দাতা (Anonymous)" : d.sender_name}
                  </td>
                  <td className="py-1 px-2">
                    {d.category ? (DONATION_CATEGORY_LABELS[d.category] || d.category) : "সাধারণ"}
                  </td>
                  <td className="py-1 px-2">{d.method} • {d.trx_id}</td>
                  <td className="py-1 px-2 text-right">{Number(d.amount).toLocaleString("bn-BD")}</td>
                </tr>
              ))}
              {monthlyDonations.length === 0 && (
                <tr><td colSpan={5} className="py-2 text-center text-gray-500">কোন অনুদান নেই</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-6">
          <h2 className="text-sm font-bold border-b pb-1 mb-2">মানবিক ব্যয়ের বিস্তারিত তালিকা</h2>
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b bg-gray-100">
                <th className="py-1 px-2">তারিখ</th>
                <th className="py-1 px-2">প্রকল্প / শিরোনাম</th>
                <th className="py-1 px-2">বিভাগ</th>
                <th className="py-1 px-2">দায়িত্বশীল / এলাকা</th>
                <th className="py-1 px-2 text-right">পরিমাণ (৳)</th>
              </tr>
            </thead>
            <tbody>
              {monthlyExpenses.map((e) => (
                <tr key={e.id} className="border-b">
                  <td className="py-1 px-2">{e.expense_date}</td>
                  <td className="py-1 px-2">{e.title}</td>
                  <td className="py-1 px-2">{e.category_label || EXPENSE_CATEGORY_LABELS[e.category]}</td>
                  <td className="py-1 px-2">{e.responsible_person || "—"} ({e.location || "নোয়াখালী"})</td>
                  <td className="py-1 px-2 text-right">{Number(e.amount).toLocaleString("bn-BD")}</td>
                </tr>
              ))}
              {monthlyExpenses.length === 0 && (
                <tr><td colSpan={5} className="py-2 text-center text-gray-500">কোন ব্যয় লিপিবদ্ধ হয়নি</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Signatures on print */}
        <div className="mt-16 pt-8 border-t grid grid-cols-3 gap-6 text-center text-xs">
          <div>
            <div className="border-t border-dashed w-32 mx-auto pt-1">প্রস্তুতকারক (অ্যাকাউন্টস)</div>
          </div>
          <div>
            <div className="border-t border-dashed w-32 mx-auto pt-1">সাধারণ সম্পাদক</div>
          </div>
          <div>
            <div className="border-t border-dashed w-32 mx-auto pt-1">সভাপতি / ট্রাস্টি</div>
          </div>
        </div>
      </div>

      {/* Screen Interface (Hidden when printing) */}
      <div className="print:hidden space-y-6">
        {/* Top Control Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-card to-muted/40 p-4 border border-border shadow-xs">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-base font-bold text-foreground">
                আর্থিক হিসাব ও রিপোর্ট ড্যাশবোর্ড
              </h2>
              <p className="text-xs text-muted-foreground">
                স্বচ্ছ অনুদান প্রাপ্তি ও মানবিক ব্যয়ের সমন্বিত হিসাব
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground shadow-xs hover:bg-muted transition active:scale-95"
            >
              <Download className="h-3.5 w-3.5 text-emerald-600" /> এক্সেল/CSV
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 transition active:scale-95"
            >
              <Printer className="h-3.5 w-3.5" /> প্রিন্ট / A4 PDF
            </button>
          </div>
        </div>

        {/* 5 Summary Cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {/* 1. Total Donations */}
          <div className="rounded-2xl border border-border bg-card p-3.5 shadow-card transition hover:border-emerald-500/40">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>মোট অনুদান</span>
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
                <ArrowUpRight className="h-3.5 w-3.5" />
              </span>
            </div>
            <p className="mt-2 font-display text-lg font-bold text-emerald-600 sm:text-xl">
              ৳{totalDonations.toLocaleString("bn-BD")}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {approvedDonations.length} টি অনুমোদিত
            </p>
          </div>

          {/* 2. Total Expenses */}
          <div className="rounded-2xl border border-border bg-card p-3.5 shadow-card transition hover:border-rose-500/40">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>মোট ব্যয়</span>
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-rose-500/10 text-rose-600">
                <ArrowDownRight className="h-3.5 w-3.5" />
              </span>
            </div>
            <p className="mt-2 font-display text-lg font-bold text-rose-600 sm:text-xl">
              ৳{totalExpenses.toLocaleString("bn-BD")}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {approvedExpenses.length} টি মানবিক প্রকল্প
            </p>
          </div>

          {/* 3. Net Remaining Fund */}
          <div className="rounded-2xl border border-border bg-card p-3.5 shadow-card transition hover:border-blue-500/40">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>অবশিষ্ট তহবিল</span>
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600">
                <Wallet className="h-3.5 w-3.5" />
              </span>
            </div>
            <p className={`mt-2 font-display text-lg font-bold sm:text-xl ${netBalance >= 0 ? "text-blue-600" : "text-destructive"}`}>
              ৳{netBalance.toLocaleString("bn-BD")}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">তহবিল স্থিতি</p>
          </div>

          {/* 4. Current Month Balance */}
          <div className="rounded-2xl border border-border bg-card p-3.5 shadow-card transition hover:border-amber-500/40">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>চলতি মাস স্থিতি</span>
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
                <Calendar className="h-3.5 w-3.5" />
              </span>
            </div>
            <p className={`mt-2 font-display text-lg font-bold sm:text-xl ${currentMonthNet >= 0 ? "text-amber-600" : "text-destructive"}`}>
              ৳{currentMonthNet.toLocaleString("bn-BD")}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              +৳{currentMonthDonations.toLocaleString("bn-BD")} / -৳{currentMonthExpenses.toLocaleString("bn-BD")}
            </p>
          </div>

          {/* 5. Pending vs Verified */}
          <div className="col-span-2 rounded-2xl border border-border bg-card p-3.5 shadow-card sm:col-span-1 transition hover:border-indigo-500/40">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>যাচাই ও অপেক্ষমান</span>
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600">
                <ShieldCheck className="h-3.5 w-3.5" />
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-muted-foreground block">অনুমোদিত</span>
                <span className="font-display text-sm font-bold text-emerald-600">
                  {approvedDonations.length} টি
                </span>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground block">পেন্ডিং</span>
                <span className="font-display text-sm font-bold text-amber-500">
                  {pendingDonations.length} টি
                </span>
              </div>
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-emerald-500"
                style={{
                  width: `${
                    donations.length > 0
                      ? (approvedDonations.length / donations.length) * 100
                      : 100
                  }%`,
                }}
              />
            </div>
          </div>
        </div>

        {/* Tab switch */}
        <div className="flex border-b border-border">
          <button
            type="button"
            onClick={() => setReportTab("overview")}
            className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-xs font-semibold transition ${
              reportTab === "overview"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Layers className="h-3.5 w-3.5" /> ক্যাটাগরিভিত্তিক বিভাজন
          </button>
          <button
            type="button"
            onClick={() => setReportTab("monthly")}
            className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-xs font-semibold transition ${
              reportTab === "monthly"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Calendar className="h-3.5 w-3.5" /> মাসিক রিপোর্ট ফিল্টার
          </button>
        </div>

        {/* Tab 1: Category Breakdown (4 Donation + 6 Expense Categories) */}
        {reportTab === "overview" && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* 4 Receiving Categories */}
            <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
                    <HandCoins className="h-4 w-4" />
                  </div>
                  <h3 className="font-display text-sm font-bold text-foreground">
                    অনুদান প্রাপ্তির ৪টি বিভাগ
                  </h3>
                </div>
                <span className="text-xs font-semibold text-emerald-600">
                  মোট: ৳{totalDonations.toLocaleString("bn-BD")}
                </span>
              </div>

              <div className="space-y-2.5">
                {donationCategoryBreakdown.map((item) => (
                  <div key={item.key} className="rounded-xl border border-border/70 bg-muted/20 p-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-foreground">{item.label}</span>
                      <span className="font-bold text-emerald-600">
                        ৳{item.total.toLocaleString("bn-BD")}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>{item.count} জন দাতা</span>
                      <span>{item.percentage}%</span>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-emerald-500 rounded-full"
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 6 Humanitarian Expense Categories */}
            <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-500/10 text-rose-600">
                    <TrendingDown className="h-4 w-4" />
                  </div>
                  <h3 className="font-display text-sm font-bold text-foreground">
                    মানবিক ব্যয়ের ৬টি বিভাগ
                  </h3>
                </div>
                <span className="text-xs font-semibold text-rose-600">
                  মোট: ৳{totalExpenses.toLocaleString("bn-BD")}
                </span>
              </div>

              <div className="space-y-2.5">
                {expenseCategoryBreakdown.map((item) => (
                  <div key={item.key} className="rounded-xl border border-border/70 bg-muted/20 p-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-foreground">{item.label}</span>
                      <span className="font-bold text-rose-600">
                        ৳{item.total.toLocaleString("bn-BD")}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>{item.count} টি প্রকল্প</span>
                      <span>{item.percentage}%</span>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-rose-500 rounded-full"
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Monthly Filter & Detail List */}
        {reportTab === "monthly" && (
          <div className="space-y-4">
            {/* Month / Year Selector */}
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-card">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <Filter className="h-4 w-4" /> মাস ও বছর নির্বাচন:
              </div>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {BENGALI_MONTHS.map((m, idx) => (
                  <option key={m} value={idx}>
                    {m}
                  </option>
                ))}
              </select>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {[2024, 2025, 2026, 2027].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>

              <div className="ml-auto flex items-center gap-3 text-xs">
                <span className="text-emerald-600 font-bold">
                  আয়: ৳{monthlyDonationsTotal.toLocaleString("bn-BD")}
                </span>
                <span className="text-rose-600 font-bold">
                  ব্যয়: ৳{monthlyExpensesTotal.toLocaleString("bn-BD")}
                </span>
                <span className={`font-bold ${monthlyNet >= 0 ? "text-blue-600" : "text-destructive"}`}>
                  ব্যালেন্স: ৳{monthlyNet.toLocaleString("bn-BD")}
                </span>
              </div>
            </div>

            {/* List Table for Selected Month */}
            <div className="rounded-2xl border border-border bg-card p-4 shadow-card space-y-4">
              <h3 className="font-display text-sm font-bold text-foreground">
                {BENGALI_MONTHS[selectedMonth]} {selectedYear} এর লেনদেন বিবরণ
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-muted-foreground">
                      <th className="py-2 px-3">তারিখ</th>
                      <th className="py-2 px-3">বিবরণ / দাতা / খাত</th>
                      <th className="py-2 px-3">শ্রেণী</th>
                      <th className="py-2 px-3">বিভাগ</th>
                      <th className="py-2 px-3 text-right">পরিমাণ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {monthlyDonations.map((d) => (
                      <tr key={d.id} className="hover:bg-muted/20">
                        <td className="py-2 px-3 font-mono text-muted-foreground">
                          {d.created_at?.split("T")[0]}
                        </td>
                        <td className="py-2 px-3 font-medium text-foreground">
                          {d.is_anonymous ? (
                            <span className="font-semibold text-primary">
                              গোপন অনুদানকারী (Anonymous)
                            </span>
                          ) : (
                            d.sender_name
                          )}
                          <span className="block text-[10px] text-muted-foreground font-mono">
                            {d.method} • {d.trx_id}
                          </span>
                        </td>
                        <td className="py-2 px-3">
                          <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600">
                            অনুদান (আয়)
                          </span>
                        </td>
                        <td className="py-2 px-3 text-muted-foreground">
                          {d.category ? (DONATION_CATEGORY_LABELS[d.category] || d.category) : "সাধারণ অনুদান"}
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-emerald-600">
                          +৳{Number(d.amount).toLocaleString("bn-BD")}
                        </td>
                      </tr>
                    ))}

                    {monthlyExpenses.map((e) => (
                      <tr key={e.id} className="hover:bg-muted/20">
                        <td className="py-2 px-3 font-mono text-muted-foreground">
                          {e.expense_date}
                        </td>
                        <td className="py-2 px-3 font-medium text-foreground">
                          {e.title}
                          {e.location && (
                            <span className="block text-[10px] text-muted-foreground">
                              এলাকা: {e.location} {e.responsible_person ? `• দায়িত্বে: ${e.responsible_person}` : ""}
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3">
                          <span className="inline-flex items-center rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold text-rose-600">
                            ত্রাণ / ব্যয়
                          </span>
                        </td>
                        <td className="py-2 px-3 text-muted-foreground">
                          {e.category_label || EXPENSE_CATEGORY_LABELS[e.category] || "ব্যয়"}
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-rose-600">
                          -৳{Number(e.amount).toLocaleString("bn-BD")}
                        </td>
                      </tr>
                    ))}

                    {monthlyDonations.length === 0 && monthlyExpenses.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-xs text-muted-foreground">
                          এই মাসে কোনো অনুদান বা খরচের হিসাব লিপিবদ্ধ নেই।
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
