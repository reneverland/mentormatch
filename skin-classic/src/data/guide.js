// 在读生指引数据，按学校原始整理内容落地；改动请同步核对官方通知。
// keywords 只参与搜索匹配，不在卡片上展示。
const guide = {
  "depts": [
    {
      "unit": "研究生院 (GS)",
      "desc": "选课/考试/成绩发布具体日期通知，档案调出/调入\n学生活动中心302自助机打印：成绩单/在读证明/排名证明/预计毕业时间证明/学习模式",
      "email": "gs@cuhk.edu.cn",
      "tel": "86 (0755) 8427 3900",
      "addr": "学生活动中心302",
      "wechat": "香港中文大学深圳研究生院",
      "keywords": "证明 在读证明 成绩单 排名 档案 选课 考试 成绩 毕业 离校",
      "links": [
        {
          "label": "各项申请",
          "url": "https://gs.cuhk.edu.cn/page/338"
        },
        {
          "label": "证明文件",
          "url": "https://gs.cuhk.edu.cn/page/243"
        },
        {
          "label": "毕业政策",
          "url": "https://gs.cuhk.edu.cn/article/306"
        },
        {
          "label": "离校手续",
          "url": "https://gs.cuhk.edu.cn/taxonomy/term/160"
        }
      ]
    },
    {
      "unit": "经管研究生教务办公室 (SME_TPG)",
      "desc": "课程申请/豁免/重修/休学请假，毕业选择，选课/考试/成绩发布通知\n盖章申请：《现实表现证明》&《实习知情同意》",
      "email": "smepg@cuhk.edu.cn",
      "tel": "86(0755) 2351 8580",
      "addr": "综合教学楼D 3楼",
      "wechat": "",
      "keywords": "选课 重修 豁免 休学 请假 实习 盖章 证明 毕业",
      "links": []
    },
    {
      "unit": "IMBA 项目办公室",
      "desc": "报到，破冰活动，实习课申请，校外导师匹配\n领取空白《毕业登记表》《就业推荐表》",
      "email": "mscimba_reg@cuhk.edu.cn",
      "tel": "86(0755) 2337 2688",
      "addr": "教学楼A 514外大办公室",
      "wechat": "港中大深圳IMBA硕士",
      "keywords": "报到 实习 导师 匹配 毕业登记表 就业推荐表 破冰",
      "links": []
    },
    {
      "unit": "资讯科技服务处 (ITSO)",
      "desc": "办事大厅，VPN，SIS，BB",
      "email": "isupport@cuhk.edu.cn",
      "tel": "86(0755) 8427 3333",
      "addr": "教学楼D栋一楼",
      "wechat": "香港中文大学深圳ITSO",
      "keywords": "网络 邮箱 VPN 校园网 账号 密码 办事大厅 SIS BB",
      "links": [
        {
          "label": "忘记密码",
          "url": "https://itso.cuhk.edu.cn/page/333#CUHK(SZ)%E8%B4%A6%E5%8F%B7"
        }
      ]
    },
    {
      "unit": "职业发展中心 (CDC)",
      "desc": "就业指导，实习推荐，校园招聘，盖章后《就业推荐表》领取",
      "email": "cdcsfi@cuhk.edu.cn",
      "tel": "86 (0755) 8427 3439",
      "addr": "教学楼A 521",
      "wechat": "深高金职业发展中心",
      "keywords": "就业 实习 求职 招聘 简历 推荐表",
      "links": []
    },
    {
      "unit": "财务处",
      "desc": "学费/住宿费/意外保险费等各费用缴纳，发票开具",
      "email": "financeoffice@cuhk.edu.cn",
      "tel": "86 (0755) 8427 3701",
      "addr": "",
      "wechat": "",
      "keywords": "缴费 交费 学费 住宿费 保险 发票 退费",
      "links": [
        {
          "label": "官网",
          "url": "https://pay.cuhk.edu.cn:3306/index.html"
        }
      ]
    },
    {
      "unit": "安保办公室",
      "desc": "户口管理，入校事宜最新通知，校园安全提示",
      "email": "securityoffice@cuhk.edu.cn",
      "tel": "86 (0755) 8427 3200",
      "addr": "TD 下首层 UD105",
      "wechat": "平安港中深",
      "keywords": "户口 门禁 入校 车辆 安全 报警",
      "links": []
    },
    {
      "unit": "学生事务处",
      "desc": "意外险报销，体检，校巴车辆安排事宜",
      "email": "osa@cuhk.edu.cn",
      "tel": "86(0755) 8427 3671",
      "addr": "",
      "wechat": "香港中文大学（深圳）OSA",
      "keywords": "保险 报销 体检 校巴 奖助 活动",
      "links": [
        {
          "label": "学生医保",
          "url": "https://osa.cuhk.edu.cn/zh-hans/basic/404"
        }
      ]
    },
    {
      "unit": "学术交流处",
      "desc": "",
      "email": "oal@cuhk.edu.cn",
      "tel": "86(0755) 8427 3519",
      "addr": "会议楼I 701室",
      "wechat": "",
      "keywords": "交换 交流 海外 访学",
      "links": [
        {
          "label": "交换/交流项目",
          "url": "https://oal.cuhk.edu.cn/page/1522"
        }
      ]
    },
    {
      "unit": "大学教务处",
      "desc": "",
      "email": "registry@cuhk.edu.cn",
      "tel": "86(0755) 8427 3626",
      "addr": "教学楼A栋108教务处",
      "wechat": "",
      "keywords": "本科 教务 课程 学籍",
      "links": [
        {
          "label": "校历/停课放假通知安排",
          "url": "https://registry.cuhk.edu.cn/"
        }
      ]
    }
  ],
  "housing": [
    {
      "unit": "逸夫书院 Shaw",
      "desc": "",
      "email": "shaw@cuhk.edu.cn",
      "tel": "0755-84273098",
      "addr": "",
      "wechat": "",
      "keywords": "住宿 入住 退宿 宿舍 公寓 书院 搬迁 换宿 住宿费",
      "links": []
    },
    {
      "unit": "祥波书院 Harmonia",
      "desc": "",
      "email": "harmonia@cuhk.edu.cn",
      "tel": "0755-23515400",
      "addr": "",
      "wechat": "",
      "keywords": "住宿 入住 退宿 宿舍 公寓 书院 搬迁 换宿 住宿费",
      "links": []
    },
    {
      "unit": "思廷书院 Muse",
      "desc": "",
      "email": "muse@cuhk.edu.cn",
      "tel": "0755-84273960",
      "addr": "",
      "wechat": "",
      "keywords": "住宿 入住 退宿 宿舍 公寓 书院 搬迁 换宿 住宿费",
      "links": []
    },
    {
      "unit": "学勤书院 Diligentia",
      "desc": "",
      "email": "diligentia@cuhk.edu.cn",
      "tel": "0755-84273912",
      "addr": "",
      "wechat": "",
      "keywords": "住宿 入住 退宿 宿舍 公寓 书院 搬迁 换宿 住宿费",
      "links": []
    },
    {
      "unit": "道扬书院 Ling",
      "desc": "",
      "email": "ling@cuhk.edu.cn",
      "tel": "0755-23515825",
      "addr": "",
      "wechat": "",
      "keywords": "住宿 入住 退宿 宿舍 公寓 书院 搬迁 换宿 住宿费",
      "links": []
    },
    {
      "unit": "厚含书院 Minerva",
      "desc": "",
      "email": "minerva@cuhk.edu.cn",
      "tel": "0755-23516380",
      "addr": "",
      "wechat": "",
      "keywords": "住宿 入住 退宿 宿舍 公寓 书院 搬迁 换宿 住宿费",
      "links": []
    },
    {
      "unit": "永平书院 Duan Family",
      "desc": "",
      "email": "duanfamily@cuhk.edu.cn",
      "tel": "0755-23517380",
      "addr": "",
      "wechat": "",
      "keywords": "住宿 入住 退宿 宿舍 公寓 书院 搬迁 换宿 住宿费",
      "links": []
    },
    {
      "unit": "第八书院 Eighth",
      "desc": "",
      "email": "8thcollege@cuhk.edu.cn",
      "tel": "0755-23518399",
      "addr": "",
      "wechat": "",
      "keywords": "住宿 入住 退宿 宿舍 公寓 书院 搬迁 换宿 住宿费",
      "links": []
    },
    {
      "unit": "大学城国际校区 XCO",
      "desc": "",
      "email": "ucco@cuhk.edu.cn",
      "tel": "0755-23519310",
      "addr": "",
      "wechat": "",
      "keywords": "住宿 入住 退宿 宿舍 公寓 书院 搬迁 换宿 住宿费",
      "links": []
    },
    {
      "unit": "如意公寓",
      "desc": "",
      "email": "ryao@cuhk.edu.cn",
      "tel": "",
      "addr": "",
      "wechat": "",
      "keywords": "住宿 入住 退宿 宿舍 公寓 书院 搬迁 换宿 住宿费",
      "links": []
    },
    {
      "unit": "宝南公寓",
      "desc": "",
      "email": "bnao@cuhk.edu.cn",
      "tel": "",
      "addr": "",
      "wechat": "",
      "keywords": "住宿 入住 退宿 宿舍 公寓 书院 搬迁 换宿 住宿费",
      "links": []
    },
    {
      "unit": "泰瑞府",
      "desc": "",
      "email": "trfao@cuhk.edu.cn",
      "tel": "",
      "addr": "",
      "wechat": "",
      "keywords": "住宿 入住 退宿 宿舍 公寓 书院 搬迁 换宿 住宿费",
      "links": []
    }
  ]
};

export const depts = guide.depts;
export const housing = guide.housing;

export default guide;
