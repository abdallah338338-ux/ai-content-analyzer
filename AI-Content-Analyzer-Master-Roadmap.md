# AI Content Analyzer — المسار الكامل والنهائي للمشروع

> **هذا الملف هو المرجع التنفيذي الوحيد للمشروع.** أي AI أو code editor يكمل المشروع يجب أن يقرأ القسم 0 ثم 1، وبعدها ينفذ الأقسام بالترتيب. لا يُعاد اقتراح بنية استضافة أو أدوات سبق رفضها إلا بطلب صريح من المستخدم.
>
> **الحالة:** Master Roadmap — إصدار تأسيسي للمشروع، قبل التنفيذ الكامل.
> **الهدف:** بناء أداة سحابية مجانية قدر الإمكان لتحليل المحتوى متعدد الوسائط، ثم الحوار معه داخل Content Session واحدة.

---

# 0) الملخص التنفيذي — اقرأه أولًا

## 0.1 فكرة المشروع

**AI Content Analyzer** هو تطبيق ويب/PWA يستطيع المستخدم من خلاله إعطاء النظام محتوى ثم التعامل معه كمصدر معرفة واحد:

- رابط فيديو YouTube عام.
- رابط فيديو Facebook عام عندما يكون الوصول إليه ممكنًا.
- صورة مرفوعة.
- لاحقًا: ملفات فيديو وصور وملفات أخرى حسب ما يثبت دعمه عمليًا.

بعد إدخال المحتوى، ينشئ النظام **Content Session** تحتوي على فهم المحتوى، ثم يستطيع المستخدم إجراء محادثة طبيعية معه:

- ما الفكرة الرئيسية؟
- ماذا حدث في الدقيقة 08:30؟
- اشرح الجزء ده ببساطة.
- ما الأدلة التي ذكرها المتحدث؟
- ماذا يظهر في الصورة؟
- استخرج النص الموجود في الصورة.
- قارن بين نقطتين وردتا في المحتوى.
- ارجع إلى جزء محدد من الفيديو عندما يكون ذلك ممكنًا.

المشروع ليس مجرد زر `Analyze`. **المحادثة المستمرة مع نفس المحتوى هي جزء أساسي من المنتج.**

## 0.2 القرار المعماري النهائي

البنية الأساسية ثابتة ومبنية على نفس معايير المشاريع السابقة:

```text
GitHub Pages
    │
    │ HTTPS / JSON / multipart
    ▼
Render Web Service
Node.js Backend
    │
    ├──────────────► Gemini API
    │                 Multimodal AI
    │
    └──────────────► Supabase
                      PostgreSQL + Storage

cron-job.org
    │
    └──────────────► Render /health
```

### المنصات الثابتة

| الوظيفة | المنصة |
|---|---|
| Frontend / PWA | GitHub Pages |
| Backend | Render Web Service — Node.js عادي، ليس Docker |
| Database | Supabase PostgreSQL |
| File Storage | Supabase Storage عند الحاجة |
| AI | Gemini API |
| Keep-alive | cron-job.org |
| Source control | GitHub |

الحسابات الأساسية موجودة بالفعل للمستخدم؛ لا نبدأ بإنشاء حسابات جديدة من الصفر.

## 0.3 قاعدة مجانية + سحابية

المطلوب أن يعمل المشروع **من السحابة دون أن يظل جهاز المستخدم مفتوحًا**.

لكن كلمة "مجاني" تعني الالتزام بالـfree tiers والـquotas الحالية للخدمات. لا يجوز لأي AI أن يَعِد المستخدم بموارد غير محدودة أو uptime مضمون إذا كانت الخطة المجانية لا تقدمه.

Render Free قد يدخل في sleep عند الخمول، لذلك يستخدم المشروع cron-job.org للـkeep-alive. هذا يقلل/يمنع النوم في الاستخدام العملي، لكنه ليس SLA رسميًا لـ24/7.

## 0.4 أهم قرار خاص بالمصادر

### YouTube

المسار الأساسي: استخدام دعم Gemini الموثق للفيديوهات العامة من YouTube عبر الرابط مباشرة، بدل تنزيل الفيديو على جهاز المستخدم.

### Facebook

لا نفترض أن Facebook URL يمكن تمريره إلى Gemini بنفس طريقة YouTube. يجب بناء طبقة **Source Resolver / Access Check**:

```text
Facebook URL
   │
   ▼
Can the backend obtain usable public media/content?
   │
   ├── نعم → Gemini
   │
   └── لا → رسالة واضحة + fallback إن وُجد
```

لا نستخدم scraping أو bypass لتجاوز تسجيل الدخول أو الخصوصية أو قيود المنصة. الفيديو الخاص أو غير القابل للوصول يُرفض بوضوح.

### Image

الصورة تدخل إلى Gemini multimodal مباشرة أو عبر مسار رفع آمن إلى backend، بحسب الحجم والتنفيذ النهائي.

## 0.5 Source of Truth

كل البيانات المهمة تحفظ في Supabase، وليس localStorage فقط.

```text
Browser = واجهة + حالة مؤقتة
Server = API + منطق المشروع
Supabase = مصدر الحقيقة الدائم
```

لا نحفظ نتائج التحليل أو الرسائل المهمة محليًا فقط.

---

# 1) العقد التقني للمشروع

> هذا القسم هو العقد بين Frontend وBackend. لا يتم تغيير أسماء الحقول أو الردود بعد بدء الواجهة إلا بتعديل موثق في هذا الملف.

## 1.1 GET `/health`

### الهدف

Health check للمتصفح وcron-job.org وRender.

### Request

```http
GET /health
```

### Success

```json
{
  "status": "ok",
  "service": "ai-content-analyzer-backend",
  "time": "<ISO timestamp>"
}
```

HTTP `200`.

---

## 1.2 POST `/api/sources/inspect`

### الهدف

تحديد نوع الرابط قبل بدء تحليل مكلف.

### Request

```json
{
  "url": "https://www.youtube.com/watch?v=..."
}
```

### Response example

```json
{
  "status": "ok",
  "source": {
    "type": "youtube",
    "url": "https://www.youtube.com/watch?v=...",
    "supported": true
  }
}
```

للـFacebook:

```json
{
  "status": "ok",
  "source": {
    "type": "facebook",
    "url": "https://www.facebook.com/...",
    "supported": "conditional"
  }
}
```

`conditional` تعني أن نجاح الوصول الفعلي يجب التحقق منه أثناء المعالجة.

---

## 1.3 POST `/api/analyze/url`

### الهدف

بدء Content Session من رابط.

### Request

```json
{
  "url": "https://www.youtube.com/watch?v=...",
  "analysis_mode": "full"
}
```

القيم المبدئية:

- `full`
- `summary`
- `timeline`
- `visual`
- `speech`
- `custom`

### Success

```json
{
  "status": "ok",
  "session": {
    "id": "session_uuid",
    "source_type": "youtube",
    "source_url": "https://...",
    "status": "completed"
  },
  "analysis": {
    "title": "...",
    "overview": "...",
    "key_points": [],
    "timeline": [],
    "speech_analysis": "...",
    "visual_analysis": "...",
    "structure": "...",
    "evidence_notes": []
  }
}
```

إذا كان التحليل طويلًا جدًا، يمكن لاحقًا تحويله إلى asynchronous job:

```text
POST /api/analyze/url
        ↓
202 Accepted
        ↓
job/session ID
        ↓
GET /api/sessions/:id
```

**لا نطبق async jobs إلا إذا أثبت الاختبار أن الطلب المباشر غير مناسب لزمن Render/Gemini.**

---

## 1.4 POST `/api/analyze/image`

### Request

`multipart/form-data`

```text
file = image file
analysis_mode = full | visual | text | custom
custom_question = optional
```

### Success

نفس بنية Content Session السابقة، مع:

```json
{
  "source_type": "image"
}
```

---

## 1.5 POST `/api/sessions/:sessionId/messages`

### الهدف

إرسال سؤال جديد متعلق بنفس Content Session.

### Request

```json
{
  "message": "اشرح الجزء الموجود عند 08:30 ببساطة"
}
```

### Response

```json
{
  "status": "ok",
  "message": {
    "id": "message_uuid",
    "role": "assistant",
    "content": "...",
    "created_at": "2026-09-17T...Z",
    "references": [
      {
        "type": "timestamp",
        "start": "08:30",
        "end": "09:10"
      }
    ]
  }
}
```

الـbackend يسترجع Context الخاص بالـsession من Supabase، ثم يرسل السؤال مع السياق اللازم إلى Gemini.

---

## 1.6 GET `/api/sessions`

### الهدف

عرض جلسات المستخدم/Workspace.

### Response

```json
{
  "status": "ok",
  "sessions": [
    {
      "id": "...",
      "title": "...",
      "source_type": "youtube",
      "created_at": "...",
      "updated_at": "..."
    }
  ]
}
```

الأحدث أولًا.

---

## 1.7 GET `/api/sessions/:sessionId`

### الهدف

إعادة فتح جلسة كاملة من أي جهاز.

### Response

```json
{
  "status": "ok",
  "session": {},
  "analysis": {},
  "messages": []
}
```

---

## 1.8 DELETE `/api/sessions/:sessionId`

### الهدف

حذف جلسة وبياناتها المرتبطة.

### Response

```json
{
  "status": "ok"
}
```

إذا كانت الجلسة مرتبطة بملفات داخل Supabase Storage، يتم حذف الملفات المرتبطة وفقًا لسياسة التخزين الخاصة بالمشروع.

---

# 2) نموذج البيانات — Supabase

## 2.1 جدول `content_sessions`

```sql
CREATE TABLE IF NOT EXISTS content_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id TEXT NOT NULL,
    source_type TEXT NOT NULL,
    source_url TEXT,
    title TEXT,
    status TEXT NOT NULL DEFAULT 'processing',
    analysis_mode TEXT,
    analysis JSONB,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### source_type

القيم المتوقعة:

```text
youtube
facebook
image
video_file
other
```

---

## 2.2 جدول `content_messages`

```sql
CREATE TABLE IF NOT EXISTS content_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES content_sessions(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    references JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### role

```text
user
assistant
system
```

---

## 2.3 جدول `content_assets`

```sql
CREATE TABLE IF NOT EXISTS content_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES content_sessions(id) ON DELETE CASCADE,
    asset_type TEXT NOT NULL,
    file_name TEXT,
    storage_path TEXT,
    mime_type TEXT,
    size_bytes BIGINT,
    public_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

هذا الجدول يستخدم للصور والملفات التي تحتاج تخزينًا دائمًا.

**لا يتم تنزيل فيديو YouTube أو Facebook إلى Storage تلقائيًا إذا كان Gemini يستطيع معالجة المصدر مباشرة.**

---

## 2.4 جدول `content_events` — اختياري للمرحلة الأولى

يستخدم لاحقًا لتسجيل مراحل المعالجة:

```text
source_detected
source_access_checked
ai_started
ai_completed
ai_failed
chat_started
chat_completed
```

لا ننشئه إلا إذا احتجنا Debugging/analytics فعليًا.

---

# 3) هوية الـWorkspace بدون تسجيل بريد إلكتروني

المشروع لا يحتاج email/password كجزء افتراضي.

لكن يجب أن يكون هناك حل عملي للمزامنة بين الأجهزة.

## القرار المبدئي

استخدام **Workspace ID / Access Code** بسيط بدل نظام حسابات كامل.

مثال:

```text
Workspace: ABD-XXXX-XXXX
```

المستخدم يستطيع فتح نفس الـworkspace من جهاز آخر بإدخال الكود أو فتح رابط workspace.

### القاعدة الأمنية

لا نضع secret database key في frontend.

الـworkspace code وحده لا يُعامل كـSupabase credential.

إذا احتجنا حماية أقوى لاحقًا، يمكن إضافة authentication حقيقي كمرحلة مستقلة، لكن لا نضيفه لمجرد التعقيد.

---

# 4) استراتيجية Gemini

## 4.1 المفتاح

`GEMINI_API_KEY` موجود على Render Environment Variables فقط.

ممنوع:

```javascript
const API_KEY = "AIza...";
```

داخل GitHub/frontend.

## 4.2 YouTube

المسار المفضل:

```text
Public YouTube URL
       ↓
Gemini video input
       ↓
Multimodal understanding
```

لا نحمل الفيديو على جهاز المستخدم فقط من أجل إرساله إلى Gemini.

## 4.3 Image

```text
Browser
  ↓ multipart
Render
  ↓
Gemini multimodal
```

إذا أصبح حجم الصورة أو عدد الطلبات مشكلة، نستخدم Supabase Storage كطبقة تخزين مؤقت/دائم حسب الحاجة.

## 4.4 Prompt Architecture

لا نضع Prompt عملاقًا واحدًا لكل شيء إذا كان ذلك يزيد التكلفة أو الضوضاء.

نقسم المطلوب منطقيًا إلى:

```text
System instructions
       +
Content context
       +
User request
       ↓
Structured response
```

التحليل الأساسي يجب أن يميز بوضوح بين:

- ما هو موجود فعليًا في المصدر.
- ما هو استنتاج.
- ما لا يمكن تحديده.

ممنوع أن يخترع Gemini timestamps أو تفاصيل غير موجودة.

---

# 5) Content Understanding Schema

التحليل الموحد المبدئي:

```json
{
  "title": "",
  "overview": "",
  "key_points": [],
  "timeline": [
    {
      "start": "00:00",
      "end": "01:30",
      "topic": "",
      "summary": ""
    }
  ],
  "speech_analysis": "",
  "visual_analysis": "",
  "structure": "",
  "evidence_notes": [],
  "entities": [],
  "uncertainties": []
}
```

هذا الـschema قابل للتوسعة، لكنه لا يجب أن يصبح ضخمًا بلا حاجة.

---

# 6) واجهة المستخدم — User Flow

## 6.1 الصفحة الرئيسية

```text
AI CONTENT ANALYZER

What do you want me to understand?

[ Paste YouTube / Facebook URL................ ]

                 OR

[ 📷 Upload Image ]

[ Analyze Content ]
```

يجب أن تكون الواجهة واضحة جدًا، وليس فيها أقسام TermBoard القديمة أو عناصر لا تخص المشروع.

## 6.2 أثناء التحليل

مراحل مرئية:

```text
✓ Reading source
→ Accessing content
→ Understanding speech
→ Understanding visuals
→ Building content memory
→ Preparing chat
```

هذه المراحل يجب أن تعكس الحالة الحقيقية قدر الإمكان، ولا نستخدم animation يوهم المستخدم بأن خطوة اكتملت وهي لم تكتمل.

## 6.3 صفحة Content Session

```text
┌──────────────────────────────────────┐
│ Source                               │
│ [preview]                            │
│                                      │
│ Title                                │
│ Overview                             │
│                                      │
│ Key Points                           │
│ Timeline                             │
│ Speech                               │
│ Visuals                              │
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│ Chat with this content              │
│                                      │
│ User                                 │
│ Assistant                            │
│ User                                 │
│ Assistant                            │
│                                      │
│ [ Ask anything about this content ] │
└──────────────────────────────────────┘
```

## 6.4 Session History

قائمة الجلسات:

```text
Today
  🎬 How Black Holes Work
  🖼 Architecture Diagram

Yesterday
  🎬 Facebook video
```

كل عنصر يعيد فتح نفس الـsession من Supabase.

---

# 7) Timestamp Intelligence

عندما يكون المصدر فيديو:

- يحاول النظام ربط الإجابات بمقاطع زمنية حقيقية.
- لا يخترع timestamp إذا لم يكن متاحًا.
- الواجهة تعرض timestamp فقط إذا كان مدعومًا من نتيجة التحليل.

مثال:

```text
08:42 — 09:35
Architecture and structural concept
```

لاحقًا يمكن جعل timestamp قابلًا للنقر إذا كان المصدر/الواجهة يسمحان بذلك.

---

# 8) Facebook Strategy — تفصيل مهم

## 8.1 المطلوب

المستخدم يستطيع لصق Facebook URL.

## 8.2 ما لا نفترضه

لا نفترض أن:

```text
Facebook URL → Gemini direct video input
```

سيعمل تلقائيًا.

## 8.3 Resolver pipeline

```text
Facebook URL
    ↓
Normalize URL
    ↓
Check public accessibility
    ↓
Can backend obtain permitted media/content?
    │
    ├── YES
    │    ↓
    │  Process with Gemini
    │
    └── NO
         ↓
     Explain failure
```

## 8.4 الخصوصية والقيود

- لا نحاول تجاوز login.
- لا نحاول تجاوز privacy settings.
- لا نطلب من المستخدم كلمة مرور Facebook.
- لا نخزن cookies/session الخاصة بالمستخدم.
- لا نبني downloader غير مصرح به لمحتوى خاص.

إذا تعذر الوصول:

```text
We couldn't access this Facebook video.
It may be private, restricted, or unavailable to the analyzer.
```

---

# 9) الصور

## 9.1 أنواع الاستخدام

الصورة ليست فقط للتعرف على الأشياء.

يجب أن يدعم النظام أسئلة مثل:

- What is shown here?
- Explain this diagram.
- Extract the visible text.
- What are the main elements?
- Explain this to a beginner.
- What information can be inferred from the image?

## 9.2 OCR

إذا كان النص داخل الصورة واضحًا، يستطيع Gemini استخراجه، لكن النتيجة يجب أن تفرق بين:

```text
Visible text
```

و:

```text
AI interpretation
```

---

# 10) التخزين والملفات

## 10.1 قاعدة أساسية

لا نرفع مصدر فيديو كامل إلى Supabase بلا سبب.

### YouTube

```text
URL → Gemini
```

### Facebook

```text
URL → resolver → usable media if permitted → Gemini
```

### Image

```text
Image → Gemini
```

### Uploaded video file — لاحقًا

```text
Browser
   ↓
Render / upload endpoint
   ↓
Gemini File API or approved processing path
   ↓
Supabase metadata/storage if persistence is needed
```

---

# 11) Backend Structure

الهيكل المقترح:

```text
ai-content-analyzer/
│
├── frontend/
│   ├── index.html
│   ├── style.css
│   ├── script.js
│   ├── manifest.json
│   ├── icon-192.png
│   └── icon-512.png
│
├── backend/
│   ├── server.js
│   ├── package.json
│   ├── .env.example
│   ├── routes/
│   │   ├── health.js
│   │   ├── analyze.js
│   │   └── sessions.js
│   ├── services/
│   │   ├── gemini.js
│   │   ├── youtube.js
│   │   ├── facebook.js
│   │   └── supabase.js
│   └── README.md
│
├── supabase/
│   └── schema.sql
│
└── AI-Content-Analyzer-Master-Roadmap.md
```

إذا ثبت أن تقسيم الملفات أكثر من اللازم على المشروع الصغير، يجوز تبسيطه إلى `server.js` واحد، لكن لا يتم إدخال framework معقد بلا سبب.

---

# 12) Frontend ↔ Backend Rules

## Frontend

مسموح له بـ:

- API base URL.
- UI state.
- temporary input.
- rendering.
- PWA files.

غير مسموح له بـ:

- Gemini API key.
- Supabase service-role key.
- database credentials.
- privileged Facebook credentials.

## Backend

هو المسؤول عن:

- validation.
- source detection.
- Gemini requests.
- Supabase queries.
- persistence.
- errors.
- session context.

---

# 13) خطوات الإعداد الكاملة — نفذها بالترتيب

> الحسابات الأساسية موجودة بالفعل. لا نعيد إنشاء الحسابات.

## 13.1 إنشاء Repository

1. أنشئ GitHub repository جديد للمشروع.
2. استخدم اسم واضح مثل:

```text
ai-content-analyzer
```

3. أضف frontend وbackend وsupabase schema.

---

## 13.2 إنشاء Supabase Project

1. افتح حساب Supabase الموجود.
2. أنشئ Project جديد للمشروع.
3. احتفظ ببيانات الاتصال المطلوبة.
4. افتح SQL Editor.
5. نفذ `supabase/schema.sql`.
6. تأكد من ظهور:
   - `content_sessions`
   - `content_messages`
   - `content_assets`
7. أنشئ Storage bucket فقط عندما تحتاج الملفات الفعلية.

### قاعدة مهمة

لا تستخدم Render local filesystem كقاعدة بيانات.

---

## 13.3 Gemini

1. افتح Google AI Studio بالحساب الموجود.
2. أنشئ/استخدم API key.
3. لا تضع المفتاح في GitHub frontend.
4. ضعه في Render Environment Variables باسم:

```text
GEMINI_API_KEY
```

5. قبل اعتماد model name نهائيًا، تحقق من models والـfree-tier الحاليين في توثيق Google الرسمي.

---

## 13.4 Backend محلي

داخل مجلد backend:

```powershell
npm install
npm start
```

أو أمر التطوير إذا أُضيف:

```powershell
npm run dev
```

اختبر:

```text
GET /health
```

ثم اختبر اتصال Supabase وGemini.

---

## 13.5 Render

1. افتح Render بالحساب الموجود.
2. `New → Web Service`.
3. اربط GitHub repository.
4. Environment = **Node**.
5. **لا تستخدم Docker.**
6. Build Command:

```text
npm install
```

7. Start Command:

```text
npm start
```

8. أضف Environment Variables:

```text
GEMINI_API_KEY=...
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

9. إذا استُخدمت PostgreSQL connection string بدل REST، أضف متغيرات الاتصال المطلوبة فقط.
10. Deploy.
11. افتح:

```text
https://YOUR-APP.onrender.com/health
```

يجب أن يرجع:

```json
{"status":"ok","service":"ai-content-analyzer"}
```

---

## 13.6 Frontend / GitHub Pages

1. ارفع frontend إلى GitHub.
2. فعّل GitHub Pages.
3. اضبط `API_BASE_URL` إلى رابط Render الحقيقي.
4. لا تضع أي secret في frontend.
5. اختبر CORS.

مثال:

```javascript
const API_BASE_URL = "https://YOUR-APP.onrender.com";
```

---

## 13.7 PWA

يجب أن يحتوي المشروع على:

```text
manifest.json
icon-192.png
icon-512.png
```

الـmanifest يتضمن:

- name
- short_name
- start_url
- display: standalone
- icons
- theme_color
- background_color

الأيقونات يجب أن تكون أصلية للمشروع وليست placeholder.

---

## 13.8 cron-job.org

1. افتح cron-job.org بالحساب الموجود.
2. أنشئ job جديد.
3. URL:

```text
https://YOUR-APP.onrender.com/health
```

4. اجعل التكرار ضمن المدى المتفق عليه في المشروع وأقل من حد sleep الموثق حاليًا في Render.
5. راقب سجل الطلبات.
6. تأكد أن `/health` يرجع HTTP 200.

لا نعتبر cron ضمانًا رسميًا لـuptime؛ هو keep-alive عملي ضمن حدود الخدمات المجانية.

---

# 14) إدارة الـGemini Context في المحادثة

المشكلة الأساسية: لا نرسل كل شيء عشوائيًا مع كل سؤال.

## المستوى الأول

```text
Session analysis
```

يحتوي على ملخص وفهم منظم.

## المستوى الثاني

```text
Recent chat messages
```

يحتوي على آخر جزء ضروري من الحوار.

## المستوى الثالث

```text
Relevant timeline / evidence
```

يُضاف عند السؤال عن جزء محدد.

الهدف:

```text
Correct context
+ lower token waste
+ consistent answers
```

إذا احتجنا نظام retrieval أكثر تعقيدًا لاحقًا، يضاف كمرحلة مستقلة وليس في V1 بلا حاجة.

---

# 15) Error Handling

كل endpoint يجب أن يعيد خطأ مفهومًا.

مثال:

```json
{
  "status": "error",
  "code": "SOURCE_UNAVAILABLE",
  "message": "The source could not be accessed."
}
```

الأكواد المبدئية:

```text
INVALID_URL
UNSUPPORTED_SOURCE
SOURCE_UNAVAILABLE
PRIVATE_SOURCE
IMAGE_TOO_LARGE
GEMINI_QUOTA
GEMINI_ERROR
DATABASE_ERROR
TIMEOUT
INTERNAL_ERROR
```

Frontend يعرض رسالة مفهومة للمستخدم، بينما backend logs يحتفظ بالتفاصيل التقنية.

---

# 16) Security Rules

1. Gemini key server-side only.
2. Supabase service key server-side only.
3. لا secrets في GitHub.
4. لا Facebook passwords.
5. لا bypass للخصوصية.
6. validate URLs.
7. validate MIME types.
8. enforce file-size limits.
9. sanitize user-generated HTML عند العرض.
10. لا تستخدم `innerHTML` مع محتوى AI الخام دون sanitization.
11. لا تعرض stack traces للمستخدم.
12. لا تسجل API keys في logs.
13. لا تسجل محتوى حساس كاملًا في logs إلا عند الحاجة للتشخيص.

---

# 17) قواعد مجانية / Quota Management

لأن Gemini والخدمات الأخرى لديها limits، يجب ألا يسمح الموقع لواجهة واحدة بإطلاق عدد غير محدود من الطلبات.

مبدئيًا:

- disable زر Analyze أثناء الطلب.
- disable Send أثناء إرسال الرسالة.
- منع duplicate requests.
- التعامل مع HTTP 429.
- عرض quota/rate-limit error مفهوم.
- عدم إعادة الطلب تلقائيًا مرات كثيرة.

لاحقًا يمكن إضافة rate limiting على backend.

---

# 18) مشاكل متوقعة + حلولها

| المشكلة | السبب المحتمل | الحل المعتمد |
|---|---|---|
| Render ينام | Free Web Service idle | cron-job.org keep-alive، مع عدم ادعاء SLA |
| البيانات تختفي من السيرفر | استخدام filesystem المحلي | Supabase |
| API key ظاهر | وضعه في frontend | Render env vars |
| YouTube يعمل لكن Facebook لا يعمل | اختلاف وصول المنصات | Resolver + fallback واضح |
| Facebook private video | غير قابل للوصول | رفض واضح، لا bypass |
| Gemini quota | حدود free tier | إدارة الطلبات + رسائل 429 |
| تحليل فيديو طويل timeout | request طويل | async job إذا أثبت الاختبار الحاجة |
| CORS | frontend/backend origins مختلفة | CORS محدود على GitHub Pages origin |
| صورة كبيرة | upload limit | validation + size limit |
| AI اخترع timestamp | prompt/validation ضعيف | لا تسمح بإنشاء timestamp غير مدعوم |
| محتوى AI يكسر HTML | عرض raw HTML | sanitize / render كنص آمن |
| Supabase connection failures | env/connection settings | تحقق من credentials وhealth checks |
| GitHub Pages لا يصل للbackend | CORS/URL خاطئ | ضبط API base + CORS |
| PWA لا تظهر | manifest/icons غير صحيحة | تحقق من paths وHTTPS |
| كثرة context في chat | إرسال التحليل كاملًا كل مرة | structured context + recent messages |
| Render RAM مرتفع | dependencies أو processing ثقيل | Node.js خفيف، streams، لا تخزين فيديو كامل بلا سبب |

---

# 19) الممنوعات / البدائل المرفوضة

هذه ليست اقتراحات بديلة افتراضية؛ لا تُعاد إلا بإذن صريح أو ظهور مشكلة جديدة تستدعي إعادة التقييم.

| الخيار | القرار | السبب |
|---|---|---|
| n8n كاستضافة دائمة على PaaS مجاني | ❌ مرفوض | المشروع السابق أثبت مشاكل موارد؛ Node.js الخفيف هو البديل |
| Docker على Render Free | ❌ غير مطلوب | استخدم Node Web Service العادي |
| Render internal DB كقاعدة أساسية | ❌ مرفوض | Supabase هو التخزين الدائم |
| Google Cloud e2-micro | ❌ خارج الاختيار الحالي | تعقيد/فوترة/بطاقة وشروط لا تناسب معيار المشروع |
| Oracle Cloud Always Free | ❌ مرفوض | غير مناسب للاستقرار المطلوب وفق القرارات السابقة |
| Fly.io | ❌ مرفوض | لا نعتمد على free tier غير متاح/غير مناسب |
| DuckDNS + Cloudflare Named Tunnel | ❌ مرفوض | تعقيد وملكية domain/zone غير ضرورية |
| Cloudflare Quick Tunnel كحل نهائي | ❌ مرفوض | الرابط مؤقت وغير مناسب كعنوان production ثابت |
| MCP Server Trigger | ❌ مرفوض | ليس مطلوبًا لهذا المعمار |
| email auth من البداية | ❌ غير مطلوب | workspace identity أبسط للمشروع الشخصي |
| localStorage كمصدر الحقيقة | ❌ مرفوض | لا يحقق مزامنة حقيقية بين الأجهزة |
| تنزيل كل YouTube videos إلى جهاز المستخدم | ❌ غير مطلوب | يهدر bandwidth ووقت المستخدم إذا كان direct URL input متاحًا |
| تجاوز Facebook login/privacy | ❌ ممنوع | لا نتحايل على وصول المنصة |

---

# 20) قرارات لا يجوز تغييرها بدون توثيق

1. المشروع Content Session وليس مجرد one-shot analyzer.
2. YouTube + Facebook + Image هي أنواع الإدخال الأساسية.
3. YouTube direct URL هو المسار الأول عندما يكون مدعومًا.
4. Facebook يحتاج access/resolver path منفصل.
5. المحادثة مرتبطة بالـsession.
6. Supabase هو Source of Truth.
7. Gemini key server-side.
8. Render Node.js Web Service.
9. cron-job.org keep-alive.
10. GitHub Pages للـfrontend.
11. PWA identity مطلوبة.
12. لا نعيد إدخال n8n للاستضافة الدائمة.

---

# 21) مراحل التنفيذ

## Phase 1 — Foundation

- [ ] GitHub repository.
- [ ] Supabase project.
- [ ] schema.
- [ ] Node backend.
- [ ] `/health`.
- [ ] Render deployment.
- [ ] Gemini environment variable.

## Phase 2 — YouTube MVP

- [ ] URL detection.
- [ ] YouTube validation.
- [ ] Direct Gemini video input.
- [ ] Structured analysis.
- [ ] Content Session persistence.
- [ ] Session page.

## Phase 3 — Chat

- [ ] message table.
- [ ] `POST /sessions/:id/messages`.
- [ ] session context.
- [ ] recent conversation context.
- [ ] timestamp references.
- [ ] reload session from database.

## Phase 4 — Image

- [ ] image upload.
- [ ] Gemini image understanding.
- [ ] image persistence where required.
- [ ] image chat.

## Phase 5 — Facebook

- [ ] URL classification.
- [ ] public-access test.
- [ ] resolver strategy.
- [ ] permitted media path.
- [ ] graceful failure.
- [ ] real-world testing with several public URLs.

## Phase 6 — PWA + Sync

- [ ] manifest.
- [ ] icons.
- [ ] install test.
- [ ] workspace identity.
- [ ] cross-device session list.

## Phase 7 — Reliability

- [ ] cron-job.org.
- [ ] quota handling.
- [ ] timeout handling.
- [ ] duplicate request protection.
- [ ] logging.
- [ ] health checks.

## Phase 8 — Optional uploaded video files

لا تبدأ قبل اكتمال المراحل السابقة.

- [ ] MP4.
- [ ] MOV.
- [ ] WebM.
- [ ] upload limits.
- [ ] Gemini File API / supported upload path.
- [ ] Storage policy.

---

# 22) Final Testing Checklist

لا تعتبر المشروع منتهيًا قبل تنفيذ البنود فعليًا.

## Infrastructure

- [ ] Render service deploys successfully.
- [ ] `/health` returns 200.
- [ ] Supabase tables exist.
- [ ] Gemini API works from backend.
- [ ] Gemini key is not exposed in frontend.
- [ ] cron-job.org is calling `/health`.
- [ ] no paid service was accidentally enabled.

## YouTube

- [ ] Public YouTube URL is accepted.
- [ ] invalid YouTube URL is rejected cleanly.
- [ ] analysis contains title/overview/key points.
- [ ] speech is analyzed when available.
- [ ] visuals are analyzed when available.
- [ ] timeline is populated when supported.
- [ ] timestamps are not fabricated.
- [ ] session is saved in Supabase.

## Chat

- [ ] first question works.
- [ ] follow-up question remembers the same content.
- [ ] third question still has correct context.
- [ ] session reload preserves messages.
- [ ] timestamp question returns evidence when available.
- [ ] chat error does not destroy the session.

## Image

- [ ] image upload works.
- [ ] image understanding works.
- [ ] OCR-style question works.
- [ ] visual explanation works.
- [ ] image session persists.

## Facebook

- [ ] public accessible Facebook URL is detected.
- [ ] supported public content is processed if the resolver can access it.
- [ ] inaccessible/private URL returns clear failure.
- [ ] no login credentials are requested.
- [ ] no privacy bypass is used.

## Cross-device

- [ ] create session on laptop.
- [ ] close laptop.
- [ ] open same workspace on phone using mobile data.
- [ ] session appears.
- [ ] open session.
- [ ] previous chat appears.
- [ ] send new message.
- [ ] refresh laptop later and verify synchronization.

## PWA

- [ ] manifest loads.
- [ ] 192px icon loads.
- [ ] 512px icon loads.
- [ ] install prompt/installation works where supported.
- [ ] standalone launch works.

## Long-term / cloud independence

- [ ] device can be turned off after requests are sent.
- [ ] application is reachable from another network.
- [ ] no localhost dependency exists.
- [ ] no local SQLite is used as primary DB.
- [ ] no local files are required for production.

---

# 23) Definition of Done

المشروع يعتبر **V1 مكتملًا** عندما:

```text
User
  ↓
opens GitHub Pages
  ↓
pastes public YouTube URL OR uploads image
  ↓
AI understands the content
  ↓
Content Session saved in Supabase
  ↓
User chats with the content
  ↓
closes device
  ↓
opens another device
  ↓
same session + chat are available
```

ويكون backend مستضافًا على Render، وGemini key مخفيًا، وSupabase هو مصدر الحقيقة، وcron-job.org مضبوطًا، ولا يحتاج الجهاز الشخصي أن يظل يعمل.

**Facebook يدخل في Definition of Done فقط بقدر ما يسمح به الوصول العام الفعلي؛ لا نعتبر أي URL Facebook مضمونًا قبل اختباره.**

---

# 24) سجل القرارات Decision Archive

## D-001 — اختيار Node.js بدل n8n

**القرار:** Node.js backend خفيف.

**السبب:** نفس منهج TermBoard؛ لا نريد خدمة أتمتة ثقيلة على free PaaS.

## D-002 — Supabase بدل local DB

**القرار:** Supabase PostgreSQL.

**السبب:** persistence + cross-device sync + server source of truth.

## D-003 — GitHub Pages للواجهة

**القرار:** static frontend/PWA على GitHub Pages.

**السبب:** فصل الواجهة عن backend، مع backend على Render.

## D-004 — YouTube direct URL

**القرار:** لا ننزل الفيديو إلى جهاز المستخدم إذا كان direct Gemini URL input متاحًا.

**السبب:** تقليل bandwidth والوقت والتعقيد.

## D-005 — Facebook conditional

**القرار:** لا نساوي Facebook بـYouTube تقنيًا.

**السبب:** الوصول إلى Facebook يعتمد على public accessibility ووسيلة المعالجة المتاحة فعليًا.

## D-006 — Content Session

**القرار:** التحليل + المحادثة + المصدر = session واحدة.

**السبب:** هذا هو جوهر المنتج وليس مجرد summarizer.

## D-007 — Workspace بدل email auth في V1

**القرار:** لا email/password في البداية.

**السبب:** المشروع شخصي، ونريد أقل تعقيد ممكن مع cross-device access.

## D-008 — Keep-alive

**القرار:** cron-job.org → `/health`.

**السبب:** تقليل Render sleep ضمن حدود free tier.

---

# 25) أشياء مؤجلة — لا تنفذها الآن إلا بطلب صريح

- [ ] User accounts كاملة.
- [ ] مشاركة session مع مستخدمين آخرين.
- [ ] Vector database.
- [ ] Embeddings/RAG معقد.
- [ ] دعم عشرات المنصات.
- [ ] تنزيل تلقائي لكل فيديو.
- [ ] Video editor.
- [ ] Browser automation ثقيل.
- [ ] Mobile native app.
- [ ] دفع/اشتراكات.
- [ ] analytics متقدمة.
- [ ] background worker منفصل.
- [ ] Redis.

الهدف هو إبقاء V1 صغيرًا، مستقرًا، مجانيًا قدر الإمكان، وسهل الصيانة.

---

# 26) تعليمات لأي AI / Code Editor يكمل المشروع

```text
أنت تكمل مشروع AI Content Analyzer.

اقرأ هذا الملف كاملًا قبل تعديل أي كود.

المنتج الأساسي:
- تحليل YouTube public URLs.
- تحليل Facebook URLs عندما يكون الوصول العام ممكنًا.
- تحليل الصور.
- إنشاء Content Session.
- محادثة مستمرة مع نفس المحتوى.
- حفظ الجلسات والرسائل في Supabase.
- مزامنة بين الأجهزة.

البنية الثابتة:
- GitHub Pages للFrontend/PWA.
- Render Web Service بنظام Node.js للBackend.
- Supabase PostgreSQL + Storage عند الحاجة.
- Gemini API للذكاء الاصطناعي.
- cron-job.org للـkeep-alive.

ممنوع:
- وضع Gemini key في frontend.
- الاعتماد على localStorage كمصدر الحقيقة.
- استخدام local SQLite كقاعدة production.
- إعادة n8n كاستضافة دائمة على free PaaS.
- Docker على Render لهذا المشروع إلا إذا طلب المستخدم ذلك صراحة.
- اقتراح Fly.io أو Oracle Cloud أو GCP e2-micro كحل تلقائي.
- تجاوز Facebook login/privacy.

قواعد التنفيذ:
1. نفذ الأقسام بالترتيب.
2. لا تنتقل للخطوة التالية قبل اختبار الحالية.
3. عند ظهور مشكلة، ابحث أولًا في قسم المشاكل والقرارات.
4. لا تغير قرارًا معماريًا نهائيًا دون توثيقه في Decision Archive.
5. لا تدّع أن Facebook مدعوم بالكامل قبل اختبار الوصول الفعلي.
6. لا تدّع uptime 24/7 كضمان رسمي للخدمات المجانية؛ قل إن التصميم سحابي ولا يعتمد على جهاز المستخدم، والـcron يقلل sleep.
7. عند اكتمال البناء، نفذ Final Testing Checklist بندًا بندًا.
8. لا تقل "المشروع انتهى" إلا بعد الاختبار الفعلي.
```

---

# 27) المرجع الأساسي للمعايير

هذا الـRoadmap مبني على منهج المشروع السابق في توثيق:

- القرار المعماري النهائي.
- العقد التقني بين الواجهة والbackend.
- خطوات الإعداد المرقمة.
- الاختبار النهائي.
- المشاكل والحلول.
- أرشيف القرارات.
- تعليمات الـAI التالي.

لكن **وظائف TermBoard الخاصة بالدراسة، PDF question bank، الامتحانات، subjects، وغيرها ليست جزءًا من هذا المشروع**.

هذا المشروع مستقل، ووظيفته هي:

```text
YouTube / Facebook / Image
          ↓
   Multimodal AI
          ↓
   Content Session
          ↓
   Persistent Chat
          ↓
 Supabase + Cross-device Sync
```

---

# 28) الحالة التنفيذية الحالية — Verified Project Status

> **هذا القسم هو المرجع الحقيقي للحالة الحالية للمشروع، وليس مجرد خطة مستقبلية.**
> أي بند مكتوب `VERIFIED` تم تنفيذه واختباره بالفعل في المشروع حتى تاريخ آخر تحديث.

## 28.1 ما تم إنجازه فعليًا

### A) التخطيط والمعمارية — VERIFIED

- [x] تم إنشاء الـMaster Roadmap الخاص بالمشروع.
- [x] تم تثبيت أن المشروع مستقل عن TermBoard.
- [x] تم تثبيت المنتج كـAI Content Analyzer / Content Chat وليس مجرد one-shot analyzer.
- [x] تم تحديد Content Session كالوحدة الأساسية للتحليل والمحادثة.
- [x] تم تحديد YouTube + Facebook + Image كأنواع الإدخال الأساسية.
- [x] تم تحديد Uploaded Video Files كمرحلة لاحقة.
- [x] تم اعتماد GitHub Pages + Render + Supabase + Gemini + cron-job.org + GitHub.
- [x] تم رفض n8n كاستضافة دائمة للمشروع.
- [x] تم اعتماد Supabase كمصدر الحقيقة الدائم.
- [x] تم اعتماد Workspace/Access Code بدل email/password في V1.
- [x] تم توثيق Facebook كمسار conditional يحتاج Access Check / Resolver واختبارًا فعليًا.

### B) التصميم وتجربة الاستخدام — DEFINED / PARTIALLY READY

تم الاتفاق على الاتجاه البصري والـUX التالي:

- واجهة Web/PWA بسيطة ونظيفة وليست Dashboard مزدحمة.
- صفحة رئيسية تحتوي على:
  - حقل URL لـYouTube/Facebook.
  - Upload Image.
  - Analyze Content.
- صفحة Content Session تحتوي على:
  - مصدر المحتوى / preview.
  - Title.
  - Overview.
  - Key Points.
  - Timeline عند توفرها.
  - Speech understanding.
  - Visual understanding.
  - Chat مرتبط بنفس المحتوى.
- Sidebar/History للجلسات السابقة.
- زر New Chat / New Session.
- Dark / Light Mode.
- تصميم متجاوب للموبايل والكمبيوتر.
- لا توجد عناصر أو وظائف قديمة من TermBoard داخل هذا المشروع.
- تم الاتفاق على تقليل الزخرفة والعناصر غير الضرورية والتركيز على المحتوى والمحادثة.

> **ملاحظة:** التصميم تم تحديده واتخاذ قراراته، لكن الـFrontend production UI لم يُنفذ/يُختبر بالكامل بعد.

### C) GitHub — VERIFIED

Repository:

```text
https://github.com/abdallah338338-ux/ai-content-analyzer
```

الحالة الحالية:

- [x] Repository موجود.
- [x] Branch الرئيسي `main`.
- [x] الهيكل الصحيح موجود في الـRepository.
- [x] `backend/` موجود.
- [x] `frontend/` موجود.
- [x] `supabase/` موجود.
- [x] `AI-Content-Analyzer-Master-Roadmap.md` موجود في الـRoot.
- [x] تم تنظيف الـRoot من النسخة القديمة الخاطئة والملفات المكررة غير المطلوبة.
- [x] لا يجب أن يحتوي GitHub على `.env` أو secrets.

الهيكل الأساسي الحالي:

```text
AI-Content-Analyzer/
├── backend/
├── frontend/
├── supabase/
├── .gitignore
└── AI-Content-Analyzer-Master-Roadmap.md
```

### D) Supabase — VERIFIED

Project:

```text
ai-content-analyzer
```

تم تنفيذ الـschema والتحقق من إنشاء الجداول الأساسية:

- [x] `content_sessions`
- [x] `content_messages`
- [x] `content_assets`

مهم:

- [x] لا يوجد احتياج لإنشاء Storage bucket في Phase 1.
- [x] Storage مؤجل حتى تحتاجه الصور/الملفات فعليًا.
- [x] العمود الخاص بالرسائل يستخدم الاسم المحفوظ الآمن:

```sql
"references" JSONB
```

ولا يتم استخدام النسخة غير المقتبسة في الـschema النهائي.

### E) Backend — VERIFIED

تم إنشاء أساس Node.js Backend داخل `backend/`، ويشمل:

- [x] `package.json`
- [x] `src/server.js`
- [x] `src/health.js` / health route بحسب الهيكل الفعلي.
- [x] Supabase client foundation.
- [x] Express.
- [x] CORS.
- [x] dotenv.
- [x] Supabase JS dependency.
- [x] `npm install` تم بنجاح محليًا.
- [x] `npm start` يعمل.

### F) Render — VERIFIED

Web Service:

```text
https://ai-content-analyzer-4i6u.onrender.com
```

تم التحقق من:

- [x] Render Web Service تم إنشاؤه.
- [x] Runtime = Node.js.
- [x] Root Directory = `backend`.
- [x] Build Command = `npm install`.
- [x] Start Command = `npm start`.
- [x] Docker غير مستخدم.
- [x] الخدمة تصل إلى حالة `Live`.
- [x] Render شغّل `node src/server.js`.
- [x] السيرفر استمع على Render port `10000`.

### G) Environment Variables — CONFIGURED

تم إعداد المتغيرات على Render server-side:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
GEMINI_API_KEY
```

لا يتم وضع القيم السرية داخل GitHub أو Frontend.

### H) `/health` — VERIFIED LIVE

تم فتح:

```text
https://ai-content-analyzer-4i6u.onrender.com/health
```

والاستجابة الفعلية التي تم اختبارها:

```json
{
  "status": "ok",
  "service": "ai-content-analyzer-backend",
  "time": "2026-09-19T09:26:02.495Z"
}
```

إذن Render + Node backend + `/health` يعملون فعليًا عبر الإنترنت.

### I) cron-job.org — CONFIGURED

- [x] تم إنشاء cron job.
- [x] الهدف هو:

```text
https://ai-content-analyzer-4i6u.onrender.com/health
```

- [x] الغرض: keep-alive عملي لتقليل Render sleep.
- [x] لا يتم اعتباره SLA رسميًا لـ24/7.

---

# 29) ما تم إنجازه مقابل ما تبقى

## 29.1 Completed / Verified

```text
PROJECT IDEA                         ✅
MASTER ROADMAP                       ✅
ARCHITECTURE                         ✅
UX / DESIGN DIRECTION                ✅
GITHUB REPOSITORY                    ✅
CORRECT REPO STRUCTURE               ✅
SUPABASE PROJECT                     ✅
SUPABASE SCHEMA                      ✅
3 CORE TABLES                        ✅
NODE BACKEND FOUNDATION              ✅
RENDER WEB SERVICE                   ✅
RENDER ENV VARIABLES                 ✅
/health                              ✅ VERIFIED LIVE
CLOUD ACCESS                         ✅
CRON KEEP-ALIVE                      ✅ CONFIGURED
```

## 29.2 Remaining / Not Yet Production-Verified

### Phase 2 — YouTube MVP

- [ ] Source inspection endpoint.
- [ ] YouTube URL validation.
- [ ] Gemini video integration من الـBackend.
- [ ] Structured analysis.
- [ ] Save analysis into `content_sessions`.
- [ ] Return a real Content Session.
- [ ] Test with a real public YouTube video.
- [ ] Verify title / overview / key points.
- [ ] Verify speech understanding.
- [ ] Verify visual understanding.
- [ ] Verify timeline when supported.
- [ ] Verify timestamps are grounded and never fabricated.

### Phase 3 — Persistent Chat

- [ ] Chat endpoint.
- [ ] Save user/assistant messages.
- [ ] Session context.
- [ ] Recent conversation context.
- [ ] Relevant timeline/evidence context.
- [ ] Timestamp references.
- [ ] Reload the same session from Supabase.
- [ ] Natural multi-turn conversation test.

### Frontend / GitHub Pages

- [ ] Production `index.html`.
- [ ] Production CSS.
- [ ] Production JavaScript.
- [ ] URL input UI.
- [ ] Image upload UI.
- [ ] Analysis loading states.
- [ ] Content Session page.
- [ ] Chat UI.
- [ ] Session history/sidebar.
- [ ] New Session / New Chat.
- [ ] Dark / Light mode.
- [ ] Responsive mobile layout.
- [ ] Connect frontend to Render API.
- [ ] Deploy to GitHub Pages.
- [ ] Test CORS from GitHub Pages.

### Phase 4 — Image

- [ ] Multipart image endpoint.
- [ ] Gemini multimodal image understanding.
- [ ] OCR-style questions.
- [ ] Visual explanation.
- [ ] Image session persistence.
- [ ] Storage only if persistence actually requires it.

### Phase 5 — Facebook

- [ ] URL classification.
- [ ] Public accessibility check.
- [ ] Resolver/access strategy.
- [ ] Permitted processing path.
- [ ] Failure handling.
- [ ] Test several real public URLs.
- [ ] Never claim universal Facebook support.

### Phase 6 — PWA + Cross-device Sync

- [ ] Workspace ID / Access Code implementation.
- [ ] Session list from Supabase.
- [ ] Session reopening from another device.
- [ ] Manifest.
- [ ] 192px icon.
- [ ] 512px icon.
- [ ] Install test.
- [ ] Standalone launch test.
- [ ] Cross-device conversation synchronization test.

### Phase 7 — Reliability

- [ ] Quota handling.
- [ ] HTTP 429 handling.
- [ ] Timeout handling.
- [ ] Duplicate-request protection.
- [ ] Production logging policy.
- [ ] CORS restriction to final frontend origin.
- [ ] File size/type validation.
- [ ] Security review.
- [ ] Final end-to-end tests.

### Phase 8 — Optional Uploaded Video Files

- [ ] MP4.
- [ ] MOV.
- [ ] WebM.
- [ ] Upload limits.
- [ ] Gemini File API / supported upload path.
- [ ] Supabase Storage policy if needed.

---

# 30) Current Architecture Snapshot

```text
                         ┌─────────────────────┐
                         │     GitHub Pages    │
                         │   Frontend / PWA    │
                         └──────────┬──────────┘
                                    │
                              HTTPS / JSON
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │        Render       │
                         │  Node.js Backend    │
                         │                     │
                         │ /health             │
                         │ /api/analyze/*      │
                         │ /api/sessions/*     │
                         └───────┬─────┬───────┘
                                 │     │
                    ┌────────────┘     └─────────────┐
                    ▼                                ▼
             ┌─────────────┐                  ┌─────────────┐
             │   Gemini    │                  │  Supabase   │
             │ Multimodal  │                  │ PostgreSQL  │
             │     AI      │                  │ + Storage   │
             └─────────────┘                  └─────────────┘
                                                     ▲
                                                     │
                                             Source of Truth

                         cron-job.org
                               │
                               ▼
                         Render /health
```

---

# 31) Next Execution Point — DO NOT SKIP

المشروع الآن **ليس بحاجة إلى إعادة تخطيط**. البنية الأساسية موجودة ومختبرة.

الخطوة التنفيذية التالية هي:

```text
PHASE 2 — YOUTUBE MVP
        ↓
POST /api/sources/inspect
        ↓
POST /api/analyze/url
        ↓
Gemini YouTube understanding
        ↓
Structured analysis
        ↓
Supabase content_sessions
        ↓
Real YouTube test
```

لكن قبل أي implementation جديد:

1. اقرأ هذا الـRoadmap كاملًا.
2. لا تعدّل `/health` إلا إذا لزم ذلك.
3. لا تبدأ Image/Facebook/Chat قبل إثبات YouTube MVP.
4. لا تبنِ Frontend production كاملًا قبل أن يثبت الـAPI الأساسي.
5. بعد نجاح YouTube backend، نبني Content Session UI ثم Chat.

---

# 32) تعليمات الحالة للـAI التالي

```text
IMPORTANT CURRENT STATUS

This project is NOT starting from zero.

The following are already DONE and VERIFIED:
- GitHub repository and structure.
- Supabase project and core tables.
- Node.js backend foundation.
- Render Web Service.
- Render environment variables.
- Live /health endpoint.
- cron-job.org keep-alive configuration.
- Product architecture and UX direction.

Do NOT recreate these.
Do NOT ask the user to create these again.
Do NOT switch hosting providers.
Do NOT introduce n8n.

The next implementation target is Phase 2 — YouTube MVP.

The current project URL is:
https://ai-content-analyzer-4i6u.onrender.com

The /health endpoint has been verified live and returned HTTP 200 with:
status = ok
service = ai-content-analyzer-backend

Build incrementally and test each integration before moving forward.
```

---

# 33) آخر حالة معروفة — Authoritative Status

```text
ROADMAP                              ✅ UPDATED
PRODUCT DEFINITION                   ✅
ARCHITECTURE                         ✅
UX / DESIGN DIRECTION               ✅
GITHUB                               ✅ VERIFIED
SUPABASE                             ✅ VERIFIED
DATABASE SCHEMA                      ✅ VERIFIED
BACKEND FOUNDATION                   ✅ VERIFIED
RENDER                               ✅ VERIFIED
ENVIRONMENT VARIABLES                ✅ CONFIGURED
/health                              ✅ VERIFIED LIVE
CRON KEEP-ALIVE                      ✅ CONFIGURED

YOUTUBE MVP                          ⏳ NEXT
CHAT                                 ⏳ PENDING
IMAGE                                ⏳ PENDING
FACEBOOK                             ⏳ PENDING / CONDITIONAL
FRONTEND PRODUCTION                  ⏳ PENDING
GITHUB PAGES                         ⏳ PENDING
PWA                                 ⏳ PENDING
CROSS-DEVICE SYNC                    ⏳ PENDING
UPLOADED VIDEO FILES                 ⏳ FUTURE
FINAL END-TO-END TEST                ⏳ PENDING

IMPLEMENTATION STATUS:
FOUNDATION VERIFIED
V1 PRODUCT NOT YET COMPLETE
NEXT STEP = PHASE 2 — YOUTUBE MVP
```

---

# نهاية AI Content Analyzer Master Roadmap
