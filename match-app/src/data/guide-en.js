const units = {
  "研究生院 (GS)": {
    unit: "Graduate School (GS)",
    desc: "Notices on course selection, exams and grades; archive in/out. Self-service printers in Student Activity Centre 302: transcript, enrolment letter, ranking, expected graduation, study mode.",
    links: { "各项申请": "Applications", "证明文件": "Certificates", "毕业政策": "Graduation policy", "离校手续": "Leaving procedures" },
  },
  "经管研究生教务办公室 (SME_TPG)": {
    unit: "SME TPG Academic Office",
    desc: "Course applications / exemption / retake / leave; graduation choices; course, exam and grade notices. Stamps: Conduct Letter and Internship Consent.",
  },
  "IMBA 项目办公室": {
    unit: "IMBA Programme Office",
    desc: "Registration, ice-breaking, practicum applications, industry mentor matching. Collect blank Graduation Registration Form and Employment Recommendation Form.",
  },
  "资讯科技服务处 (ITSO)": {
    unit: "ITSO",
    desc: "Service hall, VPN, SIS, Blackboard.",
    links: { "忘记密码": "Forgot password" },
  },
  "职业发展中心 (CDC)": {
    unit: "Career Development Centre (CDC)",
    desc: "Career advice, internship referrals, campus recruiting, collection of stamped Employment Recommendation Form.",
  },
  "财务处": {
    unit: "Finance Office",
    desc: "Tuition, housing, accident insurance and other payments; invoices.",
    links: { "官网": "Website" },
  },
  "安保办公室": {
    unit: "Security Office",
    desc: "Household registration, campus-entry notices and safety tips.",
  },
  "学生事务处": {
    unit: "Office of Student Affairs",
    desc: "Accident-insurance claims, medical check-ups and campus shuttle arrangements.",
    links: { "学生医保": "Student medical insurance" },
  },
  "学术交流处": {
    unit: "Office of Academic Links",
    links: { "交换/交流项目": "Exchange / visiting programmes" },
  },
  "大学教务处": {
    unit: "University Registry",
    links: { "校历/停课放假通知安排": "Academic calendar / holiday notices" },
  },
  "逸夫书院 Shaw": { unit: "Shaw College" },
  "祥波书院 Harmonia": { unit: "Harmonia College" },
  "思廷书院 Muse": { unit: "Muse College" },
  "学勤书院 Diligentia": { unit: "Diligentia College" },
  "道扬书院 Ling": { unit: "Ling College" },
  "厚含书院 Minerva": { unit: "Minerva College" },
  "永平书院 Duan Family": { unit: "Duan Family College" },
  "第八书院 Eighth": { unit: "Eighth College" },
  "大学城国际校区 XCO": { unit: "University Town International Campus (XCO)" },
  "如意公寓": { unit: "Ruyi Apartments" },
  "宝南公寓": { unit: "Baonan Apartments" },
  "泰瑞府": { unit: "Terry Mansion" },
};

export function guideDisplay(item, locale) {
  if (locale !== "en") {
    return { unit: item.unit, desc: item.desc || "", links: item.links || [] };
  }
  const extra = units[item.unit] || {};
  return {
    unit: extra.unit || item.unit,
    desc: extra.desc || item.desc || "",
    links: (item.links || []).map((link) => ({
      ...link,
      label: (extra.links && extra.links[link.label]) || link.label,
    })),
  };
}

export default units;
