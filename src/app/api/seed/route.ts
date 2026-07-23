import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth/session'

// Seed demo data for the current user.
// Disabled in production unless explicitly enabled via env.
export async function POST() {
  if (process.env.NODE_ENV === 'production' && process.env.ENABLE_SEED !== '1') {
    return NextResponse.json({ error: '该接口在生产环境已关闭' }, { status: 403 })
  }

  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

  // Check if user already has KBs
  const existingKbs = await db.knowledgeBase.count({ where: { ownerId: user.id } })
  if (existingKbs >= 3) {
    return NextResponse.json({ message: '已有足够知识库，跳过种子数据' })
  }

  // Create demo knowledge bases
  const techKb = await db.knowledgeBase.create({
    data: {
      name: '技术文档',
      description: '团队技术文档与规范',
      icon: '🔧',
      ownerId: user.id,
      permissions: {
        create: {
          userId: user.id,
          resourceType: 'knowledge_base',
          role: 'owner',
        },
      },
    },
  })

  const teamKb = await db.knowledgeBase.create({
    data: {
      name: '团队协作',
      description: '流程规范与会议记录',
      icon: '👥',
      ownerId: user.id,
      permissions: {
        create: {
          userId: user.id,
          resourceType: 'knowledge_base',
          role: 'owner',
        },
      },
    },
  })

  // Create demo documents
  await db.document.create({
    data: {
      title: 'README - 项目说明',
      docType: 'markdown',
      icon: '📝',
      content: '# 项目说明\n\n这是一个知识库文档系统，参考语雀设计。\n\n## 核心功能\n\n- 📚 知识库管理：创建多个知识库，分类管理文档\n- 📝 多种编辑器：文档、Markdown、表格\n- 🔐 权限管控：知识库级别权限控制\n- 🔍 全文搜索：快速查找文档内容\n- 📜 版本历史：文档修改自动保存版本\n- 📤 导入导出：支持 MD/HTML/CSV/TXT\n- 🔗 生成链接：分享文档给协作者\n\n## 技术栈\n\n- Next.js 16 + TypeScript\n- Prisma ORM + SQLite\n- Tailwind CSS + shadcn/ui\n\n## 快速开始\n\n1. 在左侧选择或创建知识库\n2. 点击「新建」选择文档类型\n3. 点击右上角「分享」管理权限\n\n---\n\n> 提示：支持三种文档类型 — 富文本文档、Markdown、表格',
      knowledgeBaseId: techKb.id,
      authorId: user.id,
      order: 0,
    },
  })

  await db.document.create({
    data: {
      title: 'API 接口规范',
      docType: 'markdown',
      icon: '📝',
      content: '# API 接口规范\n\n## 通用规则\n\n- 所有接口返回 JSON 格式\n- 使用标准 HTTP 状态码\n- 鉴权通过 Cookie Session\n\n## 接口列表\n\n### 知识库\n\n| 方法 | 路径 | 说明 |\n|------|------|------|\n| GET | /api/knowledge-bases | 获取知识库列表 |\n| POST | /api/knowledge-bases | 创建知识库 |\n| GET | /api/knowledge-bases/:id | 获取知识库详情 |\n| PUT | /api/knowledge-bases/:id | 修改知识库 |\n| DELETE | /api/knowledge-bases/:id | 删除知识库 |\n\n### 文档\n\n| 方法 | 路径 | 说明 |\n|------|------|------|\n| GET | /api/documents?kbId=xxx | 获取文档列表 |\n| POST | /api/documents | 创建文档 |\n| GET | /api/documents/:id | 获取文档详情 |\n| PUT | /api/documents/:id | 修改文档 |\n| DELETE | /api/documents/:id | 删除文档 |',
      knowledgeBaseId: techKb.id,
      authorId: user.id,
      order: 1,
    },
  })

  await db.document.create({
    data: {
      title: '数据库设计',
      docType: 'markdown',
      icon: '📝',
      content: '# 数据库设计\n\n## 核心模型\n\n### User（用户）\n- id: 唯一标识\n- email: 邮箱（唯一）\n- name: 用户名\n- password: 密码\n\n### KnowledgeBase（知识库）\n- id: 唯一标识\n- name: 知识库名称\n- description: 描述\n- icon: 图标\n- ownerId: 所有者ID\n\n### Document（文档）\n- id: 唯一标识\n- title: 标题\n- content: 内容\n- docType: 文档类型（doc/markdown/sheet）\n- knowledgeBaseId: 所属知识库\n- parentId: 父文档ID（支持树形结构）\n- authorId: 作者ID\n- order: 排序',
      knowledgeBaseId: techKb.id,
      authorId: user.id,
      order: 2,
    },
  })

  // Sheet document - team task tracking
  await db.document.create({
    data: {
      title: '团队任务跟踪表',
      docType: 'sheet',
      icon: '📊',
      content: JSON.stringify({
        columns: ['任务', '负责人', '状态', '优先级', '截止日期'],
        rows: [
          ['知识库V2开发', '张三', '进行中', '高', '2026-07-01'],
          ['API文档编写', '李四', '已完成', '中', '2026-06-25'],
          ['前端界面优化', '王五', '待开始', '中', '2026-07-05'],
          ['权限系统测试', '赵六', '进行中', '高', '2026-06-30'],
          ['部署文档整理', '张三', '待开始', '低', '2026-07-10'],
        ],
      }),
      knowledgeBaseId: techKb.id,
      authorId: user.id,
      order: 3,
    },
  })

  // Rich text document - meeting notes
  await db.document.create({
    data: {
      title: '团队周会记录',
      docType: 'doc',
      icon: '📄',
      content: '<h1>团队周会记录</h1><h2>2026-06-27</h2><h3>参会人员</h3><ul><li>产品</li><li>研发</li><li>设计</li></ul><h3>议题</h3><ol><li><b>产品迭代计划</b><ul><li>确认下周发布内容</li><li>排期讨论</li></ul></li><li><b>技术债务</b><ul><li>代码审查流程优化</li><li>测试覆盖率提升</li></ul></li><li><b>设计规范</b><ul><li>组件库更新</li><li>设计稿评审流程</li></ul></li></ol><h3>待办事项</h3><ul><li>完成知识库系统V2</li><li>制定代码规范文档</li><li>搭建CI/CD流程</li></ul><hr><blockquote>下次会议时间：2026-07-04 14:00</blockquote>',
      knowledgeBaseId: teamKb.id,
      authorId: user.id,
      order: 0,
    },
  })

  await db.document.create({
    data: {
      title: 'SOP - 新人入职流程',
      docType: 'markdown',
      icon: '📝',
      content: '# 新人入职流程 SOP\n\n## 流程概览\n\n1. HR 发送入职通知\n2. IT 配置账号与设备\n3. 部门安排导师\n4. 新人完成入职培训\n5. 导师制定 30/60/90 天计划\n\n## 详细步骤\n\n### 第一步：入职准备（入职前 3 天）\n\n- [ ] HR 创建员工档案\n- [ ] IT 准备工位与电脑\n- [ ] 开通企业邮箱与各系统账号\n- [ ] 导师确认并准备欢迎包\n\n### 第二步：入职当天\n\n- [ ] 上午：HR 办理手续、参观公司\n- [ ] 下午：IT 配置设备、导师见面\n- [ ] 下班前：确认账号全部可用\n\n### 第三步：入职第一周\n\n- [ ] 完成基础培训课程\n- [ ] 阅读团队文档与规范\n- [ ] 熟悉开发环境与工具\n- [ ] 参与第一次团队周会',
      knowledgeBaseId: teamKb.id,
      authorId: user.id,
      order: 1,
    },
  })

  // Sheet document - employee onboarding checklist
  await db.document.create({
    data: {
      title: '新人入职清单',
      docType: 'sheet',
      icon: '📊',
      content: JSON.stringify({
        columns: ['项目', '负责人', '完成状态', '备注'],
        rows: [
          ['工位安排', '行政', '已完成', 'C区12号工位'],
          ['电脑配置', 'IT', '已完成', 'MacBook Pro 16寸'],
          ['账号开通', 'IT', '进行中', '邮箱、GitLab、Jira'],
          ['导师分配', '部门主管', '已完成', '导师：张三'],
          ['入职培训', 'HR', '待开始', '安排在下周一'],
          ['30天计划', '导师', '待开始', '需在第一周完成'],
        ],
      }),
      knowledgeBaseId: teamKb.id,
      authorId: user.id,
      order: 2,
    },
  })

  return NextResponse.json({ message: '种子数据创建成功', kbs: [techKb, teamKb] })
}
