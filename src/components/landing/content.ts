export const problemCards = [
  {
    title: "Re-entering data",
    flow: ["Email", "Excel", "ERP"],
    copy: "Employees repeatedly move the same information between systems.",
  },
  {
    title: "Manual document checks",
    flow: ["Invoice", "PO", "Receipt"],
    copy: "Teams spend hours comparing documents and finding exceptions.",
  },
  {
    title: "Repetitive operations",
    flow: ["Order", "Validate", "Approve", "ERP"],
    copy: "Predictable workflows still require human attention at every step.",
  },
  {
    title: "Reporting",
    flow: ["ERP", "Excel", "CRM", "Report"],
    copy: "Employees collect and reconcile information that already exists digitally.",
  },
] as const;

export const steps = [
  {
    n: "01",
    title: "Discover",
    copy: "We learn how your team actually works and identify repetitive operational processes.",
  },
  {
    n: "02",
    title: "Measure",
    copy: "We quantify transaction volume, employee time, errors, bottlenecks and business impact.",
  },
  {
    n: "03",
    title: "Automate",
    copy: "We connect your existing systems and automate predictable steps.",
  },
  {
    n: "04",
    title: "Improve",
    copy: "We monitor results, handle exceptions and improve the workflow over time.",
  },
] as const;

export const useCases = [
  {
    id: "orders",
    title: "Customer Order Processing",
    description:
      "Automatically process incoming customer orders while sending unusual cases to a human.",
    flow: ["Email / PDF / Excel", "Extract order", "Validate SKU & price", "Check inventory", "Create ERP order"],
  },
  {
    id: "invoices",
    title: "Invoice Processing",
    description: "Reduce repetitive invoice handling while keeping finance teams in control of exceptions.",
    flow: ["Invoice", "Extract", "Duplicate check", "PO / receipt matching", "Approval", "Accounting"],
  },
  {
    id: "reporting",
    title: "Reporting & Reconciliation",
    description: "Bring data together automatically instead of manually building the same reports every week.",
    flow: ["ERP + CRM + Excel", "Collect", "Validate", "Reconcile", "Report"],
  },
  {
    id: "documents",
    title: "Document Workflows",
    description: "Automatically understand, organize and route incoming business documents.",
    flow: ["Email", "Document", "Classify", "Extract", "Validate", "Route"],
  },
] as const;

export const systems = [
  "1C",
  "ArmSoft",
  "Microsoft Excel",
  "Google Sheets",
  "Gmail",
  "Outlook",
  "ERP systems",
  "CRM systems",
  "Databases",
  "REST APIs",
  "Internal software",
] as const;

export const outcomes = [
  {
    title: "Less manual work",
    copy: "Reduce repetitive data entry and checking.",
  },
  {
    title: "Fewer errors",
    copy: "Apply the same validation rules consistently.",
  },
  {
    title: "Faster operations",
    copy: "Move information between teams and systems automatically.",
  },
  {
    title: "More capacity",
    copy: "Allow existing teams to handle more business without increasing repetitive workload at the same rate.",
  },
] as const;

export const faqs = [
  {
    q: "What kinds of processes can be automated?",
    a: "Processes that repeat often, follow understandable rules, and move data or documents between systems. Typical examples include order intake, invoice handling, reporting, and routing incoming files. Judgment-heavy or one-off work usually stays with people.",
  },
  {
    q: "Do we need to replace our existing software?",
    a: "No. The preferred approach is to connect the systems you already use — ERP, email, spreadsheets, CRM, and internal tools — wherever that is technically feasible.",
  },
  {
    q: "Does everything use AI?",
    a: "No. AI is used where understanding or reasoning helps, such as reading unstructured documents. Predictable checks, routing, and system updates are handled with ordinary automation and rules.",
  },
  {
    q: "Can people approve important decisions?",
    a: "Yes. Human-in-the-loop review is a core design principle. Exceptions and material decisions can be sent to the right person before anything is posted or sent.",
  },
  {
    q: "What happens during the process assessment?",
    a: "A short AI-guided interview asks how your operations work today. It looks for repetitive processes, time spent, systems involved, and where automation may be worth a closer look. You get an initial reading — not a finished implementation plan.",
  },
  {
    q: "Is the assessment free?",
    a: "Yes. The initial process assessment is free and does not require a project commitment.",
  },
] as const;
