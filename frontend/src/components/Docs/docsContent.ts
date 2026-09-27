export type Localized = { en: string; hi: string };

export type DocCell = string | Localized | { code: string };

export type DocBlock =
  | { kind: 'p'; text: Localized }
  | { kind: 'h3'; text: Localized }
  | { kind: 'list'; items: Localized[] }
  | { kind: 'steps'; items: Localized[] }
  | { kind: 'table'; columns: Localized[]; rows: DocCell[][] }
  | { kind: 'code'; label: string; code: string }
  | { kind: 'note'; text: Localized };

export interface DocSection {
  id: string;
  title: Localized;
  summary: Localized;
  blocks: DocBlock[];
}

export interface DocGroup {
  title: Localized;
  sections: DocSection[];
}

const L = (en: string, hi: string): Localized => ({ en, hi });
const c = (code: string) => ({ code });

export const DOC_GROUPS: DocGroup[] = [
  {
    title: L('Getting started', 'शुरुआत'),
    sections: [
      {
        id: 'overview',
        title: L('Introduction', 'परिचय'),
        summary: L(
          'RuraLens is an AI-enabled digital twin for villages. It brings infrastructure monitoring, scheme oversight and citizen services into one platform.',
          'RuraLens गांवों के लिए AI-आधारित डिजिटल ट्विन है। यह इंफ्रास्ट्रक्चर निगरानी, योजना निरीक्षण और नागरिक सेवाओं को एक ही प्लेटफॉर्म पर लाता है।'
        ),
        blocks: [
          {
            kind: 'p',
            text: L(
              'Administrators, field workers and citizens all work from the same live model of the village: its water tanks, pumps, pipelines, power nodes and roads, the government schemes running in it, and the issues residents raise.',
              'प्रशासक, फील्ड कर्मचारी और नागरिक सभी गांव के एक ही लाइव मॉडल पर काम करते हैं: पानी की टंकियां, पंप, पाइपलाइन, बिजली नोड और सड़कें, गांव में चल रही सरकारी योजनाएं, और निवासियों द्वारा उठाई गई समस्याएं।'
            ),
          },
          { kind: 'h3', text: L('Modules', 'मॉड्यूल') },
          {
            kind: 'table',
            columns: [L('Module', 'मॉड्यूल'), L('What it does', 'यह क्या करता है')],
            rows: [
              [L('Dashboard', 'डैशबोर्ड'), L('Live overview of infrastructure health, alerts and key indicators.', 'इंफ्रास्ट्रक्चर की स्थिति, अलर्ट और मुख्य संकेतकों का लाइव सारांश।')],
              [L('3D Map View', '3D मैप व्यू'), L('Interactive map of village assets. Trigger a failure on any asset and see its predicted impact.', 'गांव की संपत्तियों का इंटरैक्टिव मैप। किसी भी संपत्ति पर विफलता चलाएं और उसका अनुमानित प्रभाव देखें।')],
              [L('Government Schemes', 'सरकारी योजनाएं'), L('Track scheme phases, budgets and vendor reports, and ask questions about them with AI.', 'योजनाओं के चरण, बजट और वेंडर रिपोर्ट ट्रैक करें और AI से उनके बारे में प्रश्न पूछें।')],
              [L('AQI & Weather', 'AQI और मौसम'), L('Current air quality and weather for the village, from Open-Meteo.', 'Open-Meteo से गांव की वर्तमान वायु गुणवत्ता और मौसम।')],
              [L('Citizen Reports', 'नागरिक रिपोर्ट'), L('Anonymous complaints with private tracking and automatic escalation.', 'निजी ट्रैकिंग और स्वचालित एस्केलेशन के साथ गुमनाम शिकायतें।')],
              [L('Citizen Call Records', 'नागरिक कॉल रिकॉर्ड'), L('Complaints received by phone through the Kavya calling agent. Administrators only.', 'काव्या कॉलिंग एजेंट के ज़रिए फोन पर मिली शिकायतें। केवल प्रशासकों के लिए।')],
            ],
          },
          { kind: 'h3', text: L('AI capabilities', 'AI क्षमताएं') },
          {
            kind: 'list',
            items: [
              L('**RAG Knowledge Engine** answers questions about schemes and documents, citing its sources.', '**RAG ज्ञान इंजन** योजनाओं और दस्तावेज़ों से जुड़े प्रश्नों के उत्तर स्रोतों के हवाले के साथ देता है।'),
              L('**GNN Impact Forecaster** predicts how a failure spreads through connected infrastructure.', '**GNN प्रभाव पूर्वानुमान** बताता है कि एक विफलता जुड़े हुए इंफ्रास्ट्रक्चर में कैसे फैलती है।'),
              L('**Discrepancy Detector** checks vendor progress reports against the approved scheme plan.', '**डिस्क्रेपेंसी डिटेक्टर** वेंडर प्रगति रिपोर्ट की स्वीकृत योजना से जांच करता है।'),
              L('**Kavya** takes complaints over an ordinary phone call for areas with poor internet.', '**काव्या** कमजोर इंटरनेट वाले क्षेत्रों के लिए सामान्य फोन कॉल पर शिकायतें लेती है।'),
            ],
          },
        ],
      },
      {
        id: 'architecture',
        title: L('Architecture', 'आर्किटेक्चर'),
        summary: L(
          'RuraLens is made of a web frontend, an API backend, a document retrieval service and a graph neural network service.',
          'RuraLens एक वेब फ्रंटएंड, एक API बैकएंड, एक दस्तावेज़ रिट्रीवल सेवा और एक ग्राफ न्यूरल नेटवर्क सेवा से मिलकर बना है।'
        ),
        blocks: [
          {
            kind: 'table',
            columns: [L('Component', 'घटक'), L('Technology', 'तकनीक'), L('Responsibility', 'ज़िम्मेदारी')],
            rows: [
              [L('Frontend', 'फ्रंटएंड'), 'React 18, TypeScript, Vite, Tailwind CSS, MapLibre GL', L('Dashboards, 3D map, forms and the bilingual English and Hindi interface.', 'डैशबोर्ड, 3D मैप, फॉर्म और द्विभाषी अंग्रेज़ी व हिंदी इंटरफ़ेस।')],
              [L('Backend API', 'बैकएंड API'), 'Node.js, Express, MongoDB, JWT', L('Authentication, role-based access, schemes, reports, call records and coordination of AI services.', 'प्रमाणीकरण, भूमिका-आधारित पहुंच, योजनाएं, रिपोर्ट, कॉल रिकॉर्ड और AI सेवाओं का समन्वय।')],
              [L('RAG service', 'RAG सेवा'), L('Pathway-compatible service (Docker)', 'Pathway-संगत सेवा (Docker)'), L('Indexes scheme documents and returns answers with source passages.', 'योजना दस्तावेज़ों को इंडेक्स करती है और स्रोत अंशों के साथ उत्तर देती है।')],
              [L('GNN service', 'GNN सेवा'), 'Python, FastAPI, PyTorch Geometric', L('Predicts the cascading impact of infrastructure failures.', 'इंफ्रास्ट्रक्चर विफलताओं के फैलते प्रभाव का पूर्वानुमान लगाती है।')],
              [L('External services', 'बाहरी सेवाएं'), 'Open-Meteo, Hugging Face, Google Gemini, Ringg AI', L('Weather and air quality, language models, and voice calls.', 'मौसम और वायु गुणवत्ता, भाषा मॉडल और वॉइस कॉल।')],
            ],
          },
          { kind: 'h3', text: L('How a request flows', 'एक अनुरोध कैसे चलता है') },
          {
            kind: 'steps',
            items: [
              L('The browser loads the frontend, which calls the backend at the address set in `VITE_API_URL`.', 'ब्राउज़र फ्रंटएंड लोड करता है, जो `VITE_API_URL` में दिए पते पर बैकएंड को कॉल करता है।'),
              L('The backend checks the user\'s token and role.', 'बैकएंड उपयोगकर्ता के टोकन और भूमिका की जांच करता है।'),
              L('It reads and writes village data in MongoDB.', 'यह MongoDB में गांव का डेटा पढ़ता और लिखता है।'),
              L('For AI features it calls the RAG service, the GNN service or a language model, and returns one structured response to the browser.', 'AI सुविधाओं के लिए यह RAG सेवा, GNN सेवा या भाषा मॉडल को कॉल करता है और ब्राउज़र को एक संरचित उत्तर लौटाता है।'),
            ],
          },
        ],
      },
      {
        id: 'roles',
        title: L('Roles and access', 'भूमिकाएं और पहुंच'),
        summary: L(
          'Every account has a role. The role decides which modules a person sees and which actions they can take.',
          'हर खाते की एक भूमिका होती है। भूमिका तय करती है कि व्यक्ति कौन से मॉड्यूल देखेगा और कौन सी कार्रवाई कर सकेगा।'
        ),
        blocks: [
          {
            kind: 'table',
            columns: [L('Role', 'भूमिका'), L('Intended for', 'किसके लिए'), L('Access', 'पहुंच')],
            rows: [
              [L('Administrator', 'प्रशासक'), L('Panchayat and block administrators', 'पंचायत और ब्लॉक प्रशासक'), L('Every module, including Citizen Call Records, and managing report status, assignment and priority.', 'नागरिक कॉल रिकॉर्ड सहित सभी मॉड्यूल, और रिपोर्ट की स्थिति, असाइनमेंट व प्राथमिकता का प्रबंधन।')],
              [L('Field worker', 'फील्ड कर्मचारी'), L('Maintenance and inspection staff', 'रखरखाव और निरीक्षण कर्मचारी'), L('A dedicated field worker workspace, plus the map, AQI & weather and citizen reports.', 'एक समर्पित फील्ड कर्मचारी वर्कस्पेस, साथ में मैप, AQI और मौसम तथा नागरिक रिपोर्ट।')],
              [L('Citizen', 'नागरिक'), L('Village residents', 'गांव के निवासी'), L('Dashboard, map, government schemes, AQI & weather and citizen reports.', 'डैशबोर्ड, मैप, सरकारी योजनाएं, AQI और मौसम तथा नागरिक रिपोर्ट।')],
            ],
          },
          {
            kind: 'note',
            text: L(
              'Anonymous reports are never linked to the account that submitted them. See Anonymous citizen reports for how identity is protected.',
              'गुमनाम रिपोर्ट कभी भी भेजने वाले खाते से नहीं जोड़ी जातीं। पहचान कैसे सुरक्षित रहती है, यह जानने के लिए "गुमनाम नागरिक रिपोर्ट" देखें।'
            ),
          },
        ],
      },
    ],
  },
  {
    title: L('Features', 'सुविधाएं'),
    sections: [
      {
        id: 'rag',
        title: L('RAG Knowledge Engine', 'RAG ज्ञान इंजन'),
        summary: L(
          'Ask questions about schemes, circulars and reports in plain language, and get answers that cite their sources.',
          'योजनाओं, परिपत्रों और रिपोर्टों के बारे में साधारण भाषा में प्रश्न पूछें और स्रोतों के हवाले के साथ उत्तर पाएं।'
        ),
        blocks: [
          {
            kind: 'p',
            text: L(
              'Retrieval-Augmented Generation (RAG) first finds the most relevant passages in the indexed documents, then writes an answer using only those passages. Every answer comes with citations, so an officer can check it against the original record. When the documents do not contain enough information, the engine says so instead of guessing.',
              'Retrieval-Augmented Generation (RAG) पहले इंडेक्स किए गए दस्तावेज़ों में सबसे प्रासंगिक अंश खोजता है, फिर केवल उन्हीं अंशों से उत्तर लिखता है। हर उत्तर के साथ स्रोत दिए जाते हैं ताकि अधिकारी मूल रिकॉर्ड से उसकी जांच कर सकें। जब दस्तावेज़ों में पर्याप्त जानकारी नहीं होती, तो इंजन अनुमान लगाने के बजाय यह साफ़ बता देता है।'
            ),
          },
          { kind: 'h3', text: L('Where to find it', 'यह कहां मिलेगा') },
          {
            kind: 'p',
            text: L(
              'Open **Government Schemes** and select **Ask AI**. Administrators can also open it from the admin dashboard.',
              '**सरकारी योजनाएं** खोलें और **Ask AI** चुनें। प्रशासक इसे एडमिन डैशबोर्ड से भी खोल सकते हैं।'
            ),
          },
          { kind: 'h3', text: L('How a question is answered', 'प्रश्न का उत्तर कैसे बनता है') },
          {
            kind: 'steps',
            items: [
              L('The question (up to 500 characters) is sent to `POST /api/rag-query`. It can be limited to one scheme with `scheme_id`.', 'प्रश्न (अधिकतम 500 अक्षर) `POST /api/rag-query` पर भेजा जाता है। `scheme_id` से इसे किसी एक योजना तक सीमित किया जा सकता है।'),
              L('If the same question was asked in the last two minutes, the cached answer is returned immediately.', 'अगर यही प्रश्न पिछले दो मिनट में पूछा गया था, तो कैश किया गया उत्तर तुरंत लौटा दिया जाता है।'),
              L('Personal data is redacted before the question leaves the backend: email addresses, phone numbers, Aadhaar numbers and PAN numbers.', 'प्रश्न बैकएंड से बाहर जाने से पहले व्यक्तिगत जानकारी हटा दी जाती है: ईमेल पते, फोन नंबर, आधार नंबर और PAN नंबर।'),
              L('Ranking questions, such as which scheme is performing best, are answered from live scheme metrics in the database.', 'रैंकिंग वाले प्रश्न, जैसे कौन सी योजना सबसे अच्छा प्रदर्शन कर रही है, डेटाबेस के लाइव योजना आंकड़ों से उत्तर दिए जाते हैं।'),
              L('Other questions go to the retrieval service, which returns an answer of at most 250 words and the passages it used.', 'बाकी प्रश्न रिट्रीवल सेवा को जाते हैं, जो अधिकतम 250 शब्दों का उत्तर और उसमें इस्तेमाल हुए अंश लौटाती है।'),
              L('The backend attaches scheme details to each citation and returns the answer, up to 10 citations (5 by default) and a `trace_id` for support.', 'बैकएंड हर स्रोत के साथ योजना का विवरण जोड़ता है और उत्तर, अधिकतम 10 स्रोत (डिफ़ॉल्ट 5) और सहायता के लिए एक `trace_id` लौटाता है।'),
            ],
          },
          {
            kind: 'code',
            label: 'POST /api/rag-query',
            code: `{
  "question": "Which schemes are delayed and why?",
  "scheme_id": "sch002",
  "max_citations": 5
}`,
          },
          {
            kind: 'code',
            label: 'Response',
            code: `{
  "answer": "...",
  "citations": [
    { "doc_id": "sch002", "snippet": "...", "score": 0.91 }
  ],
  "trace_id": "trace_...",
  "cached": false
}`,
          },
          {
            kind: 'note',
            text: L(
              'Signed-in users can ask up to 10 questions per minute.',
              'साइन-इन किए हुए उपयोगकर्ता प्रति मिनट अधिकतम 10 प्रश्न पूछ सकते हैं।'
            ),
          },
          { kind: 'h3', text: L('Updating the document index', 'दस्तावेज़ इंडेक्स अपडेट करना') },
          {
            kind: 'p',
            text: L(
              'Export the latest scheme documents from MongoDB, then ask the running retrieval service to reload its index.',
              'MongoDB से नवीनतम योजना दस्तावेज़ एक्सपोर्ट करें, फिर चल रही रिट्रीवल सेवा से इंडेक्स दोबारा लोड करवाएं।'
            ),
          },
          {
            kind: 'code',
            label: 'Terminal',
            code: `cd backend
npm run export-pathway
curl -X POST http://localhost:8000/v1/index/reload`,
          },
        ],
      },
      {
        id: 'gnn',
        title: L('GNN Impact Forecaster', 'GNN प्रभाव पूर्वानुमान'),
        summary: L(
          'Predict how a single failure spreads through the village\'s connected infrastructure, and which assets to fix first.',
          'पूर्वानुमान लगाएं कि एक विफलता गांव के जुड़े हुए इंफ्रास्ट्रक्चर में कैसे फैलती है, और किन संपत्तियों को पहले ठीक करना है।'
        ),
        blocks: [
          {
            kind: 'p',
            text: L(
              'The village is modelled as a graph. Tanks, pumps, pipelines, power nodes, roads and buildings are nodes, and the dependencies between them are edges. A graph neural network (GNN) trained on cascading-failure scenarios estimates how strongly each node is affected when another node fails.',
              'गांव को एक ग्राफ के रूप में मॉडल किया गया है। टंकियां, पंप, पाइपलाइन, बिजली नोड, सड़कें और इमारतें नोड हैं, और उनके बीच की निर्भरताएं एज हैं। फैलती विफलताओं के परिदृश्यों पर प्रशिक्षित ग्राफ न्यूरल नेटवर्क (GNN) अनुमान लगाता है कि किसी एक नोड के विफल होने पर हर दूसरा नोड कितना प्रभावित होगा।'
            ),
          },
          { kind: 'h3', text: L('Running a simulation', 'सिमुलेशन चलाना') },
          {
            kind: 'steps',
            items: [
              L('Open **3D Map View**.', '**3D मैप व्यू** खोलें।'),
              L('Select an infrastructure asset on the map.', 'मैप पर कोई इंफ्रास्ट्रक्चर संपत्ति चुनें।'),
              L('Choose a failure type: Supply Disruption, Contamination Alert, Power Failure, Infrastructure Damage or Complete Failure.', 'विफलता का प्रकार चुनें: Supply Disruption, Contamination Alert, Power Failure, Infrastructure Damage या Complete Failure।'),
              L('Choose a severity of Low, Medium or High, then select **Trigger Failure**.', 'गंभीरता Low, Medium या High चुनें, फिर **Trigger Failure** चुनें।'),
              L('The map updates to show which assets are affected and how severely.', 'मैप अपडेट होकर दिखाता है कि कौन सी संपत्तियां प्रभावित हैं और कितनी गंभीरता से।'),
            ],
          },
          { kind: 'h3', text: L('Model architecture', 'मॉडल आर्किटेक्चर') },
          {
            kind: 'table',
            columns: [L('Layer', 'लेयर'), L('Configuration', 'कॉन्फ़िगरेशन')],
            rows: [
              ['1', 'GCNConv 24 → 128, ReLU, dropout 0.3'],
              ['2', L('GATConv with 4 heads × 32, weighted edges, residual connection', 'GATConv, 4 heads × 32, भारित एज, residual connection')],
              ['3', L('GCNConv 128 → 128, residual connection', 'GCNConv 128 → 128, residual connection')],
              [L('Output', 'आउटपुट'), L('Linear 128 → 12, sigmoid applied at inference', 'Linear 128 → 12, इन्फरेंस पर sigmoid')],
            ],
          },
          {
            kind: 'p',
            text: L(
              '**Inputs.** Each node has 24 features: its infrastructure type (12 values, one-hot) and 12 operational values, including capacity, current level, flow rate, status, criticality, population served, economic value, connectivity, maintenance score, weather risk and failure history.',
              '**इनपुट।** हर नोड के 24 फीचर होते हैं: उसका इंफ्रास्ट्रक्चर प्रकार (12 मान, one-hot) और 12 परिचालन मान, जिनमें क्षमता, वर्तमान स्तर, प्रवाह दर, स्थिति, महत्व, सेवा प्राप्त आबादी, आर्थिक मूल्य, कनेक्टिविटी, रखरखाव स्कोर, मौसम जोखिम और विफलता इतिहास शामिल हैं।'
            ),
          },
          {
            kind: 'p',
            text: L(
              '**Outputs.** For every node the model returns 12 scores between 0 and 1: impact probability, severity, time to impact, water, power, road and building impact, population affected, economic loss, recovery time, repair priority and confidence.',
              '**आउटपुट।** हर नोड के लिए मॉडल 0 से 1 के बीच 12 स्कोर लौटाता है: प्रभाव की संभावना, गंभीरता, प्रभाव तक का समय, पानी, बिजली, सड़क और इमारत पर प्रभाव, प्रभावित आबादी, आर्थिक नुकसान, रिकवरी समय, मरम्मत प्राथमिकता और विश्वसनीयता।'
            ),
          },
          { kind: 'h3', text: L('Training', 'प्रशिक्षण') },
          {
            kind: 'list',
            items: [
              L('1,000 synthetic village graphs of 10 to 30 nodes each, labelled by simulating how failures cascade.', '10 से 30 नोड वाले 1,000 सिंथेटिक गांव ग्राफ, जिन्हें विफलताओं के फैलाव का सिमुलेशन करके लेबल किया गया।'),
              L('Five-fold cross-validation, 50 epochs, Adam optimiser with a learning rate of 0.001.', 'पांच-फोल्ड क्रॉस-वैलिडेशन, 50 epochs, 0.001 learning rate वाला Adam optimiser।'),
              L('Weighted binary cross-entropy loss, with critical nodes weighted three times higher.', 'भारित binary cross-entropy loss, जिसमें महत्वपूर्ण नोड्स को तीन गुना अधिक भार दिया गया।'),
              L('Best validation loss 0.81; average across folds 0.83.', 'सर्वश्रेष्ठ validation loss 0.81; सभी फोल्ड का औसत 0.83।'),
            ],
          },
          { kind: 'h3', text: L('API', 'API') },
          {
            kind: 'code',
            label: 'POST /api/gnn/predict-structured',
            code: `{
  "nodeId": "pump-main",
  "failureType": "Power Failure",
  "severity": "high"
}`,
          },
          {
            kind: 'code',
            label: 'Response',
            code: `{
  "success": true,
  "modelSource": "python-model",
  "sourceNodeId": "pump-main",
  "impact": { ... },
  "affectedNodes": [ ... ]
}`,
          },
          {
            kind: 'note',
            text: L(
              'The model runs as a separate service. If it cannot be reached, the backend returns a rule-based estimate instead and sets `modelSource` to `js-fallback`. On Render\'s free plan the service sleeps when idle, so the first prediction after a pause takes longer.',
              'मॉडल एक अलग सेवा के रूप में चलता है। अगर वह उपलब्ध नहीं है, तो बैकएंड नियम-आधारित अनुमान लौटाता है और `modelSource` को `js-fallback` रखता है। Render के फ्री प्लान पर यह सेवा खाली रहने पर सो जाती है, इसलिए रुकने के बाद पहला पूर्वानुमान ज़्यादा समय लेता है।'
            ),
          },
        ],
      },
      {
        id: 'discrepancy',
        title: L('Discrepancy Detector', 'डिस्क्रेपेंसी डिटेक्टर'),
        summary: L(
          'Compare what vendors report against the approved scheme plan, and flag budget, timeline and scope mismatches automatically.',
          'वेंडर की रिपोर्ट की स्वीकृत योजना से तुलना करें और बजट, समय-सीमा व कार्यक्षेत्र की असंगतियों को स्वचालित रूप से चिह्नित करें।'
        ),
        blocks: [
          {
            kind: 'p',
            text: L(
              'Each government scheme in RuraLens has an approved plan made up of phases, a budget and a timeline. When a vendor submits a progress report, the detector reads the PDF and checks each claim against that plan.',
              'RuraLens में हर सरकारी योजना की एक स्वीकृत योजना होती है, जिसमें चरण, बजट और समय-सीमा होती है। जब वेंडर प्रगति रिपोर्ट जमा करता है, तो डिटेक्टर PDF पढ़कर हर दावे की उस योजना से जांच करता है।'
            ),
          },
          { kind: 'h3', text: L('Submitting a vendor report', 'वेंडर रिपोर्ट जमा करना') },
          {
            kind: 'steps',
            items: [
              L('Open **Government Schemes** and choose the scheme.', '**सरकारी योजनाएं** खोलें और योजना चुनें।'),
              L('Under **Upload Vendor Progress Report**, upload the vendor\'s report as a PDF.', '**Upload Vendor Progress Report** के अंतर्गत वेंडर की रिपोर्ट PDF के रूप में अपलोड करें।'),
              L('The analysis is saved to the scheme\'s report history, and the scheme\'s budget, progress and status are updated.', 'विश्लेषण योजना के रिपोर्ट इतिहास में सहेजा जाता है, और योजना का बजट, प्रगति व स्थिति अपडेट हो जाती है।'),
            ],
          },
          { kind: 'h3', text: L('What the analysis contains', 'विश्लेषण में क्या होता है') },
          {
            kind: 'list',
            items: [
              L('An overall compliance score, plus separate scores for budget, timeline, scope and quality.', 'कुल अनुपालन स्कोर, साथ में बजट, समय-सीमा, कार्यक्षेत्र और गुणवत्ता के अलग-अलग स्कोर।'),
              L('A risk level and a list of discrepancies, each with a severity.', 'जोखिम स्तर और असंगतियों की सूची, हर एक की गंभीरता के साथ।'),
              L('Overdue work, a budget breakdown, the items that match the plan, and recommendations.', 'लंबित कार्य, बजट विवरण, योजना से मेल खाने वाले मद और सुझाव।'),
            ],
          },
          { kind: 'h3', text: L('Verification status', 'सत्यापन स्थिति') },
          {
            kind: 'table',
            columns: [L('Overall compliance', 'कुल अनुपालन'), L('Report status', 'रिपोर्ट स्थिति')],
            rows: [
              [L('80% or more', '80% या अधिक'), L('Approved', 'स्वीकृत')],
              [L('60% to 79%', '60% से 79%'), L('Under review', 'समीक्षाधीन')],
              [L('Below 60%', '60% से कम'), L('Rejected', 'अस्वीकृत')],
            ],
          },
          { kind: 'h3', text: L('Scheme status', 'योजना स्थिति') },
          {
            kind: 'table',
            columns: [L('Condition', 'स्थिति'), L('Scheme becomes', 'योजना की नई स्थिति')],
            rows: [
              [L('Any critical discrepancy', 'कोई भी गंभीर असंगति'), L('Discrepant', 'असंगत')],
              [L('Discrepancies found and compliance below 70%', 'असंगतियां मिलीं और अनुपालन 70% से कम'), L('Delayed', 'विलंबित')],
              [L('No discrepancies and all phases at 100%', 'कोई असंगति नहीं और सभी चरण 100%'), L('Completed', 'पूर्ण')],
              [L('No discrepancies and compliance of 70% or more', 'कोई असंगति नहीं और अनुपालन 70% या अधिक'), L('On track', 'सही दिशा में')],
            ],
          },
          {
            kind: 'p',
            text: L(
              'The expense claimed in the report is added to the scheme\'s utilised budget and to the phase\'s spend. The phase\'s progress is set from the compliance score, and the scheme\'s overall progress is the average of its phases.',
              'रिपोर्ट में दावा किया गया खर्च योजना के उपयोग किए गए बजट और चरण के खर्च में जोड़ा जाता है। चरण की प्रगति अनुपालन स्कोर से तय होती है, और योजना की कुल प्रगति उसके सभी चरणों का औसत होती है।'
            ),
          },
          {
            kind: 'note',
            text: L(
              'Citizens can also leave feedback on a scheme. Feedback they mark as urgent is recorded as a discrepancy for administrators to review.',
              'नागरिक भी किसी योजना पर प्रतिक्रिया दे सकते हैं। जिस प्रतिक्रिया को वे अत्यावश्यक चिह्नित करते हैं, वह प्रशासकों की समीक्षा के लिए असंगति के रूप में दर्ज होती है।'
            ),
          },
        ],
      },
      {
        id: 'kavya',
        title: L('Kavya calling agent', 'काव्या कॉलिंग एजेंट'),
        summary: L(
          'Kavya is an AI voice agent that takes complaints over an ordinary phone call, so residents without reliable internet can still reach the administration.',
          'काव्या एक AI वॉइस एजेंट है जो सामान्य फोन कॉल पर शिकायतें लेती है, ताकि बिना भरोसेमंद इंटरनेट वाले निवासी भी प्रशासन तक पहुंच सकें।'
        ),
        blocks: [
          {
            kind: 'p',
            text: L(
              'Kavya answers calls on behalf of RuraLens and collects the details of the caller\'s problem. It runs on the Ringg AI voice platform. After each call, the conversation is transcribed and summarised in English and Hindi, and the call is stored in RuraLens as a structured record.',
              'काव्या RuraLens की ओर से कॉल उठाती है और कॉल करने वाले की समस्या का विवरण लेती है। यह Ringg AI वॉइस प्लेटफॉर्म पर चलती है। हर कॉल के बाद बातचीत का ट्रांसक्रिप्ट बनता है, अंग्रेज़ी और हिंदी में सारांश तैयार होता है, और कॉल RuraLens में एक संरचित रिकॉर्ड के रूप में सहेजी जाती है।'
            ),
          },
          { kind: 'h3', text: L('What is recorded for each call', 'हर कॉल के लिए क्या दर्ज होता है') },
          {
            kind: 'table',
            columns: [L('Field', 'फ़ील्ड'), L('Description', 'विवरण')],
            rows: [
              [L('Summary', 'सारांश'), L('A short description of the complaint, in English and Hindi.', 'शिकायत का संक्षिप्त विवरण, अंग्रेज़ी और हिंदी में।')],
              [L('Key points', 'मुख्य बिंदु'), L('The important facts the caller mentioned.', 'कॉल करने वाले द्वारा बताए गए महत्वपूर्ण तथ्य।')],
              [L('Action items', 'कार्रवाई बिंदु'), L('Follow-up actions for the administration.', 'प्रशासन के लिए आगे की कार्रवाई।')],
              [L('Classification', 'वर्गीकरण'), L('The type of issue raised.', 'उठाई गई समस्या का प्रकार।')],
              [L('Transcript', 'ट्रांसक्रिप्ट'), L('The full conversation, turn by turn.', 'पूरी बातचीत, हर बारी के साथ।')],
              [L('Call details', 'कॉल विवरण'), L('Phone numbers, direction, status, duration and time of the call.', 'फोन नंबर, दिशा, स्थिति, अवधि और कॉल का समय।')],
            ],
          },
          { kind: 'h3', text: L('Reviewing calls', 'कॉल की समीक्षा') },
          {
            kind: 'p',
            text: L(
              'Administrators open **Citizen Call Records** to see every call, read its summary and transcript, and follow up on the action items. Calls are synced from Ringg AI and stored in the RuraLens database.',
              'प्रशासक **नागरिक कॉल रिकॉर्ड** खोलकर हर कॉल देखते हैं, उसका सारांश और ट्रांसक्रिप्ट पढ़ते हैं और कार्रवाई बिंदुओं पर आगे बढ़ते हैं। कॉल Ringg AI से सिंक होकर RuraLens डेटाबेस में सहेजी जाती हैं।'
            ),
          },
        ],
      },
      {
        id: 'reports',
        title: L('Anonymous citizen reports', 'गुमनाम नागरिक रिपोर्ट'),
        summary: L(
          'Residents can report problems without revealing who they are, follow progress with a private token, and rely on automatic escalation if nothing happens.',
          'निवासी अपनी पहचान बताए बिना समस्याएं दर्ज कर सकते हैं, एक निजी टोकन से प्रगति देख सकते हैं, और कार्रवाई न होने पर स्वचालित एस्केलेशन पर भरोसा कर सकते हैं।'
        ),
        blocks: [
          { kind: 'h3', text: L('Submitting a report', 'रिपोर्ट दर्ज करना') },
          {
            kind: 'p',
            text: L(
              'A report needs a title, a description and a category: road, water, power, waste, healthcare, education, corruption, safety or other. The location and up to three photos are optional.',
              'रिपोर्ट के लिए शीर्षक, विवरण और श्रेणी आवश्यक है: सड़क, पानी, बिजली, कचरा, स्वास्थ्य, शिक्षा, भ्रष्टाचार, सुरक्षा या अन्य। स्थान और अधिकतम तीन फोटो वैकल्पिक हैं।'
            ),
          },
          { kind: 'h3', text: L('How identity is protected', 'पहचान कैसे सुरक्षित रहती है') },
          {
            kind: 'list',
            items: [
              L('Names and other personal details are removed from the text by AI before the report is stored.', 'रिपोर्ट सहेजने से पहले AI द्वारा पाठ से नाम और अन्य व्यक्तिगत विवरण हटा दिए जाते हैं।'),
              L('The original wording is kept only as a one-way hash.', 'मूल शब्द केवल एक one-way hash के रूप में रखे जाते हैं।'),
              L('Map coordinates are rounded to two decimal places, roughly one kilometre.', 'मैप निर्देशांक दो दशमलव स्थानों तक, यानी लगभग एक किलोमीटर तक, राउंड किए जाते हैं।'),
              L('The reporter receives a token that tracks the report but does not identify them.', 'रिपोर्ट करने वाले को एक टोकन मिलता है जो रिपोर्ट को ट्रैक करता है, लेकिन उनकी पहचान नहीं बताता।'),
            ],
          },
          { kind: 'h3', text: L('Tracking progress', 'प्रगति ट्रैक करना') },
          {
            kind: 'p',
            text: L(
              'After submitting, the reporter is shown a reporter token. Entering it later shows the report\'s current status and every update made to it. A report moves through Pending, Acknowledged, Assigned, In progress, Resolved and Closed, or it can be Rejected. Residents can also vote on reports, add feedback, and escalate a report themselves.',
              'रिपोर्ट दर्ज करने के बाद एक रिपोर्टर टोकन दिखाया जाता है। बाद में इसे दर्ज करने पर रिपोर्ट की वर्तमान स्थिति और उसके सभी अपडेट दिखते हैं। रिपोर्ट Pending, Acknowledged, Assigned, In progress, Resolved और Closed चरणों से गुज़रती है, या Rejected हो सकती है। निवासी रिपोर्ट पर वोट कर सकते हैं, प्रतिक्रिया जोड़ सकते हैं और खुद भी रिपोर्ट एस्केलेट कर सकते हैं।'
            ),
          },
          { kind: 'h3', text: L('Automatic escalation', 'स्वचालित एस्केलेशन') },
          {
            kind: 'table',
            columns: [L('Level', 'स्तर'), L('Authority', 'प्राधिकारी'), L('Time to respond', 'जवाब देने का समय')],
            rows: [
              ['1', L('Village Sarpanch', 'ग्राम सरपंच'), L('7 days', '7 दिन')],
              ['2', L('Block Development Officer', 'खंड विकास अधिकारी'), L('10 days', '10 दिन')],
              ['3', L('District Magistrate', 'ज़िला मजिस्ट्रेट'), L('14 days', '14 दिन')],
              ['4', L('State-level authority', 'राज्य स्तरीय प्राधिकारी'), L('21 days', '21 दिन')],
            ],
          },
          {
            kind: 'p',
            text: L(
              'A background job checks deadlines. If a report is still open when its deadline passes, it moves to the next level, a new deadline is set, and the change is added to the report\'s history.',
              'एक बैकग्राउंड प्रक्रिया समय-सीमाओं की जांच करती है। अगर समय-सीमा बीतने पर भी रिपोर्ट खुली है, तो वह अगले स्तर पर चली जाती है, नई समय-सीमा तय होती है और यह बदलाव रिपोर्ट के इतिहास में जुड़ जाता है।'
            ),
          },
        ],
      },
    ],
  },
  {
    title: L('Reference', 'संदर्भ'),
    sections: [
      {
        id: 'api',
        title: L('API reference', 'API संदर्भ'),
        summary: L(
          'The backend serves every endpoint under `/api`. Protected endpoints expect a token in the `Authorization: Bearer <token>` header.',
          'बैकएंड सभी एंडपॉइंट `/api` के अंतर्गत देता है। सुरक्षित एंडपॉइंट `Authorization: Bearer <token>` हेडर में टोकन की अपेक्षा करते हैं।'
        ),
        blocks: [
          { kind: 'h3', text: L('Authentication', 'प्रमाणीकरण') },
          {
            kind: 'table',
            columns: [L('Method', 'मेथड'), L('Endpoint', 'एंडपॉइंट'), L('Description', 'विवरण')],
            rows: [
              [c('POST'), c('/api/auth/register'), L('Create an account.', 'खाता बनाएं।')],
              [c('POST'), c('/api/auth/login'), L('Sign in and receive a token.', 'साइन इन करें और टोकन पाएं।')],
              [c('GET'), c('/api/auth/me'), L('Return the signed-in user.', 'साइन-इन उपयोगकर्ता की जानकारी लौटाएं।')],
            ],
          },
          { kind: 'h3', text: L('Schemes', 'योजनाएं') },
          {
            kind: 'table',
            columns: [L('Method', 'मेथड'), L('Endpoint', 'एंडपॉइंट'), L('Description', 'विवरण')],
            rows: [
              [c('GET'), c('/api/schemes'), L('List schemes.', 'योजनाओं की सूची।')],
              [c('POST'), c('/api/schemes'), L('Create a scheme.', 'योजना बनाएं।')],
              [c('GET'), c('/api/schemes/:id'), L('Get one scheme.', 'एक योजना का विवरण।')],
              [c('DELETE'), c('/api/schemes/:id'), L('Delete a scheme.', 'योजना हटाएं।')],
              [c('POST'), c('/api/schemes/extract-from-pdf'), L('Create scheme details from a PDF.', 'PDF से योजना विवरण बनाएं।')],
              [c('POST'), c('/api/schemes/:id/vendor-report'), L('Upload and analyse a vendor report PDF.', 'वेंडर रिपोर्ट PDF अपलोड और विश्लेषण करें।')],
              [c('GET'), c('/api/schemes/:id/feedback'), L('List citizen feedback for a scheme.', 'योजना पर नागरिक प्रतिक्रियाओं की सूची।')],
              [c('POST'), c('/api/schemes/:id/feedback'), L('Submit feedback on a scheme.', 'योजना पर प्रतिक्रिया दें।')],
            ],
          },
          { kind: 'h3', text: L('AI services', 'AI सेवाएं') },
          {
            kind: 'table',
            columns: [L('Method', 'मेथड'), L('Endpoint', 'एंडपॉइंट'), L('Description', 'विवरण')],
            rows: [
              [c('POST'), c('/api/rag-query'), L('Ask the RAG Knowledge Engine a question.', 'RAG ज्ञान इंजन से प्रश्न पूछें।')],
              [c('GET'), c('/api/gnn/status'), L('Check whether the impact model is ready.', 'जांचें कि प्रभाव मॉडल तैयार है या नहीं।')],
              [c('GET'), c('/api/gnn/graph'), L('Return the current infrastructure graph.', 'वर्तमान इंफ्रास्ट्रक्चर ग्राफ लौटाएं।')],
              [c('POST'), c('/api/gnn/predict-structured'), L('Predict the impact of a failure on one node.', 'किसी नोड की विफलता का प्रभाव अनुमानित करें।')],
              [c('POST'), c('/api/gnn/what-if'), L('Run a what-if scenario.', 'What-if परिदृश्य चलाएं।')],
              [c('GET'), c('/api/gnn/vulnerable-nodes'), L('List the most vulnerable assets.', 'सबसे संवेदनशील संपत्तियों की सूची।')],
            ],
          },
          { kind: 'h3', text: L('Citizen reports and calls', 'नागरिक रिपोर्ट और कॉल') },
          {
            kind: 'table',
            columns: [L('Method', 'मेथड'), L('Endpoint', 'एंडपॉइंट'), L('Description', 'विवरण')],
            rows: [
              [c('POST'), c('/api/anonymous-reports'), L('Submit an anonymous report.', 'गुमनाम रिपोर्ट दर्ज करें।')],
              [c('GET'), c('/api/anonymous-reports/track/:token'), L('Track a report with its reporter token.', 'रिपोर्टर टोकन से रिपोर्ट ट्रैक करें।')],
              [c('POST'), c('/api/anonymous-reports/:id/escalate'), L('Escalate a report to the next level.', 'रिपोर्ट को अगले स्तर पर एस्केलेट करें।')],
              [c('PUT'), c('/api/anonymous-reports/:id/status'), L('Update a report\'s status.', 'रिपोर्ट की स्थिति अपडेट करें।')],
              [c('GET'), c('/api/anonymous-reports/stats/overview'), L('Summary statistics for reports.', 'रिपोर्टों के सारांश आंकड़े।')],
              [c('GET'), c('/api/ringg/calls'), L('List calls received by Kavya.', 'काव्या को मिली कॉल की सूची।')],
              [c('GET'), c('/api/ringg/call-summary'), L('Get the summary of a call.', 'किसी कॉल का सारांश।')],
            ],
          },
          { kind: 'h3', text: L('Health', 'स्वास्थ्य जांच') },
          {
            kind: 'table',
            columns: [L('Method', 'मेथड'), L('Endpoint', 'एंडपॉइंट'), L('Description', 'विवरण')],
            rows: [
              [c('GET'), c('/health'), L('Backend health check.', 'बैकएंड स्वास्थ्य जांच।')],
              [c('GET'), c('/status'), L('GNN service health check.', 'GNN सेवा स्वास्थ्य जांच।')],
            ],
          },
        ],
      },
      {
        id: 'security',
        title: L('Security and privacy', 'सुरक्षा और गोपनीयता'),
        summary: L(
          'RuraLens handles complaints and public records, so personal data is kept out of AI requests and access is limited by role.',
          'RuraLens शिकायतें और सार्वजनिक रिकॉर्ड संभालता है, इसलिए व्यक्तिगत जानकारी AI अनुरोधों से दूर रखी जाती है और पहुंच भूमिका के अनुसार सीमित रहती है।'
        ),
        blocks: [
          {
            kind: 'list',
            items: [
              L('Sign-in uses signed JSON Web Tokens, and each account has a role that limits what it can see and change.', 'साइन-इन में हस्ताक्षरित JSON Web Tokens का उपयोग होता है, और हर खाते की भूमिका तय करती है कि वह क्या देख और बदल सकता है।'),
              L('Email addresses, phone numbers, Aadhaar numbers and PAN numbers are redacted before a question is sent to an AI model.', 'किसी AI मॉडल को प्रश्न भेजने से पहले ईमेल पते, फोन नंबर, आधार नंबर और PAN नंबर हटा दिए जाते हैं।'),
              L('AI questions are rate-limited and cached to protect the services from overload.', 'सेवाओं को अधिक भार से बचाने के लिए AI प्रश्नों पर दर-सीमा और कैश लागू है।'),
              L('Anonymous reports are stripped of personal details, keep only a hash of the original text, and store approximate locations.', 'गुमनाम रिपोर्टों से व्यक्तिगत विवरण हटाए जाते हैं, मूल पाठ का केवल hash रखा जाता है, और स्थान अनुमानित रूप में सहेजा जाता है।'),
              L('The backend only accepts browser requests from the frontend address set in `FRONTEND_URL`.', 'बैकएंड केवल `FRONTEND_URL` में दिए फ्रंटएंड पते से आने वाले ब्राउज़र अनुरोध स्वीकार करता है।'),
            ],
          },
        ],
      },
      {
        id: 'deployment',
        title: L('Deployment and configuration', 'डिप्लॉयमेंट और कॉन्फ़िगरेशन'),
        summary: L(
          'RuraLens deploys to Render as three services defined in `render.yaml`. It can also run on a local machine.',
          'RuraLens, `render.yaml` में परिभाषित तीन सेवाओं के रूप में Render पर डिप्लॉय होता है। इसे लोकल मशीन पर भी चलाया जा सकता है।'
        ),
        blocks: [
          {
            kind: 'table',
            columns: [L('Render service', 'Render सेवा'), L('Type', 'प्रकार'), L('Source folder', 'स्रोत फ़ोल्डर')],
            rows: [
              [c('ruralens-frontend'), L('Static site', 'स्टैटिक साइट'), c('frontend')],
              [c('ruralens-backend'), 'Node.js', c('backend')],
              [c('ruralens-gnn-api'), 'Python (FastAPI)', c('backend/python-gnn')],
            ],
          },
          { kind: 'h3', text: L('Environment variables', 'एनवायरनमेंट वेरिएबल') },
          {
            kind: 'table',
            columns: [L('Variable', 'वेरिएबल'), L('Service', 'सेवा'), L('Purpose', 'उद्देश्य')],
            rows: [
              [c('MONGODB_URI'), L('Backend', 'बैकएंड'), L('MongoDB connection string.', 'MongoDB कनेक्शन स्ट्रिंग।')],
              [c('JWT_SECRET'), L('Backend', 'बैकएंड'), L('Secret used to sign sign-in tokens.', 'साइन-इन टोकन पर हस्ताक्षर करने की गुप्त कुंजी।')],
              [c('FRONTEND_URL'), L('Backend', 'बैकएंड'), L('Frontend address allowed to call the API.', 'API को कॉल करने की अनुमति वाला फ्रंटएंड पता।')],
              [c('PYTHON_GNN_API_URL'), L('Backend', 'बैकएंड'), L('Address of the GNN service.', 'GNN सेवा का पता।')],
              [c('PATHWAY_MCP_URL'), L('Backend', 'बैकएंड'), L('Address of the RAG retrieval service.', 'RAG रिट्रीवल सेवा का पता।')],
              [c('PATHWAY_MCP_TOKEN'), L('Backend', 'बैकएंड'), L('Token for the RAG service, if it requires one.', 'RAG सेवा का टोकन, अगर आवश्यक हो।')],
              [c('GEMINI_API_KEY'), L('Backend', 'बैकएंड'), L('Google Gemini, used for document analysis.', 'Google Gemini, दस्तावेज़ विश्लेषण के लिए।')],
              [c('HUGGINGFACE_API_KEY'), L('Backend', 'बैकएंड'), L('Hugging Face model calls.', 'Hugging Face मॉडल कॉल।')],
              [c('RINGG_API_KEY'), L('Backend', 'बैकएंड'), L('Ringg AI key for Kavya call records, used with `RINGG_ASSISTANT_ID`.', 'काव्या कॉल रिकॉर्ड के लिए Ringg AI कुंजी, `RINGG_ASSISTANT_ID` के साथ।')],
              [c('ADMIN_EMAIL'), L('Backend', 'बैकएंड'), L('Email of the administrator account created on first start, with `ADMIN_PASSWORD` and `ADMIN_NAME`.', 'पहली बार शुरू होने पर बनने वाले प्रशासक खाते का ईमेल, `ADMIN_PASSWORD` और `ADMIN_NAME` के साथ।')],
              [c('VITE_API_URL'), L('Frontend', 'फ्रंटएंड'), L('Backend address used by the browser.', 'ब्राउज़र द्वारा उपयोग किया जाने वाला बैकएंड पता।')],
              [c('MODEL_PATH'), L('GNN', 'GNN'), L('Path to the trained model file.', 'प्रशिक्षित मॉडल फ़ाइल का पथ।')],
            ],
          },
          { kind: 'h3', text: L('Running locally', 'लोकल रूप से चलाना') },
          {
            kind: 'p',
            text: L(
              'You need Node.js 18 or later, Python 3.11 or later, and a MongoDB database. Copy `backend/.env.example` to `backend/.env` and fill in the variables above.',
              'आपको Node.js 18 या बाद का संस्करण, Python 3.11 या बाद का संस्करण और एक MongoDB डेटाबेस चाहिए। `backend/.env.example` को `backend/.env` में कॉपी करें और ऊपर दिए वेरिएबल भरें।'
            ),
          },
          {
            kind: 'code',
            label: 'Terminal',
            code: `# Frontend (from the repository root)
npm install
npm run dev

# Backend
cd backend
npm install
npm run dev

# GNN service
cd backend/python-gnn
pip install -r requirements-render.txt
uvicorn api_server:app --port 8001

# RAG service (optional, Docker)
docker compose --env-file backend/.env -f docker-compose.pathway.yml up -d --build`,
          },
        ],
      },
      {
        id: 'troubleshooting',
        title: L('Troubleshooting', 'समस्या निवारण'),
        summary: L('Common problems and how to fix them.', 'आम समस्याएं और उनके समाधान।'),
        blocks: [
          { kind: 'h3', text: L('Impact predictions return `js-fallback`', 'प्रभाव पूर्वानुमान `js-fallback` लौटा रहा है') },
          {
            kind: 'p',
            text: L(
              'The backend could not reach the GNN service. Open the GNN service\'s `/status` URL to wake it and confirm it is running, check its logs on Render, and make sure `PYTHON_GNN_API_URL` on the backend points to it.',
              'बैकएंड GNN सेवा तक नहीं पहुंच सका। GNN सेवा का `/status` URL खोलकर उसे जगाएं और पुष्टि करें कि वह चल रही है, Render पर उसके लॉग देखें, और सुनिश्चित करें कि बैकएंड का `PYTHON_GNN_API_URL` सही पते पर है।'
            ),
          },
          { kind: 'h3', text: L('Browser requests are blocked by CORS', 'ब्राउज़र अनुरोध CORS द्वारा रोके जा रहे हैं') },
          {
            kind: 'p',
            text: L(
              'Set `FRONTEND_URL` on the backend to the exact address of the frontend, without a trailing slash, and redeploy the backend.',
              'बैकएंड पर `FRONTEND_URL` को फ्रंटएंड के सटीक पते पर सेट करें, अंत में स्लैश के बिना, और बैकएंड को दोबारा डिप्लॉय करें।'
            ),
          },
          { kind: 'h3', text: L('Port 3001 is already in use', 'पोर्ट 3001 पहले से उपयोग में है') },
          {
            kind: 'p',
            text: L(
              'Another process is using the backend\'s port. On Windows, stop it with PowerShell and start the backend again.',
              'कोई दूसरी प्रक्रिया बैकएंड के पोर्ट का उपयोग कर रही है। Windows पर PowerShell से उसे बंद करें और बैकएंड फिर से शुरू करें।'
            ),
          },
          {
            kind: 'code',
            label: 'PowerShell',
            code: `Get-NetTCPConnection -LocalPort 3001 -State Listen |
  Select-Object -ExpandProperty OwningProcess -Unique |
  ForEach-Object { taskkill /PID $_ /F }`,
          },
          { kind: 'h3', text: L('RAG answers fail with "service temporarily unavailable"', 'RAG उत्तर "service temporarily unavailable" के साथ विफल') },
          {
            kind: 'p',
            text: L(
              'The retrieval service is not running or rejected the request. Start it, and check that `PATHWAY_MCP_URL` and `PATHWAY_MCP_TOKEN` match its configuration.',
              'रिट्रीवल सेवा नहीं चल रही है या उसने अनुरोध अस्वीकार कर दिया। उसे शुरू करें, और जांचें कि `PATHWAY_MCP_URL` और `PATHWAY_MCP_TOKEN` उसके कॉन्फ़िगरेशन से मेल खाते हैं।'
            ),
          },
        ],
      },
    ],
  },
];

export const DOC_SECTIONS: DocSection[] = DOC_GROUPS.flatMap((group) => group.sections);
