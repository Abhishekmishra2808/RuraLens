import { useState } from 'react';
import {
  Shield,
  Send,
  MapPin,
  Camera,
  X,
  Loader2,
  AlertTriangle,
  CheckCircle,
  Copy,
  Info,
  Route,
  Droplet,
  Zap,
  Trash2,
  Stethoscope,
  BookOpen,
  Scale,
  FileText
} from 'lucide-react';
import { useAnonymousReports } from '../../hooks/useAnonymousReports';
import { useLanguage } from '../../i18n/LanguageContext';

const CATEGORIES = [
  { id: 'road', label: { en: 'Road & Infrastructure', hi: 'सड़क और अवसंरचना' }, icon: Route, description: { en: 'Potholes, broken roads, bridges, drainage', hi: 'गड्ढे, टूटी सड़कें, पुल, जल निकासी' } },
  { id: 'water', label: { en: 'Water Supply', hi: 'जल आपूर्ति' }, icon: Droplet, description: { en: 'Water shortage, contamination, pipeline issues', hi: 'जल कमी, दूषित पानी, पाइपलाइन समस्याएं' } },
  { id: 'power', label: { en: 'Electricity', hi: 'बिजली' }, icon: Zap, description: { en: 'Power cuts, voltage issues, streetlights', hi: 'बिजली कटौती, वोल्टेज समस्या, स्ट्रीटलाइट' } },
  { id: 'waste', label: { en: 'Waste Management', hi: 'कचरा प्रबंधन' }, icon: Trash2, description: { en: 'Garbage collection, dumping, sanitation', hi: 'कचरा संग्रह, डंपिंग, स्वच्छता' } },
  { id: 'healthcare', label: { en: 'Healthcare', hi: 'स्वास्थ्य सेवा' }, icon: Stethoscope, description: { en: 'Medical facilities, ambulance, health camps', hi: 'चिकित्सा सुविधाएं, एम्बुलेंस, स्वास्थ्य शिविर' } },
  { id: 'education', label: { en: 'Education', hi: 'शिक्षा' }, icon: BookOpen, description: { en: 'Schools, teachers, mid-day meals', hi: 'स्कूल, शिक्षक, मध्यान्ह भोजन' } },
  { id: 'corruption', label: { en: 'Corruption', hi: 'भ्रष्टाचार' }, icon: Scale, description: { en: 'Bribery, misuse of funds, irregularities', hi: 'रिश्वत, धन का दुरुपयोग, अनियमितताएं' } },
  { id: 'safety', label: { en: 'Safety', hi: 'सुरक्षा' }, icon: Shield, description: { en: 'Crime, harassment, security concerns', hi: 'अपराध, उत्पीड़न, सुरक्षा चिंताएं' } },
  { id: 'other', label: { en: 'Other', hi: 'अन्य' }, icon: FileText, description: { en: 'Any other local issues', hi: 'अन्य स्थानीय समस्याएं' } }
];

export default function AnonymousReportForm() {
  const { lang } = useLanguage();
  const tx = (en: string, hi: string) => (lang === 'hi' ? hi : en);
  const { submitReport } = useAnonymousReports();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    location: '',
    district: ''
  });
  const [photos, setPhotos] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [coords, setCoords] = useState<[number, number] | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    reportId?: string;
    reporterToken?: string;
    error?: string;
  } | null>(null);
  const [tokenCopied, setTokenCopied] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const detectLocation = () => {
    setDetecting(true);
    if (!navigator.geolocation) {
      alert(tx('Geolocation is not supported', 'जियोलोकेशन समर्थित नहीं है'));
      setDetecting(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setCoords([longitude, latitude]);
        setDetecting(false);
      },
      (error) => {
        console.error('Location error:', error);
        alert(tx('Could not detect location', 'स्थान का पता नहीं चल सका'));
        setDetecting(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length + photos.length > 3) {
      alert(tx('Maximum 3 photos allowed', 'अधिकतम 3 फोटो की अनुमति है'));
      return;
    }

    const validFiles = files.filter(file => {
      if (!file.type.startsWith('image/')) {
        alert(tx(`${file.name} is not an image`, `${file.name} इमेज नहीं है`));
        return false;
      }
      if (file.size > 5 * 1024 * 1024) {
        alert(tx(`${file.name} is too large (max 5MB)`, `${file.name} बहुत बड़ा है (अधिकतम 5MB)`));
        return false;
      }
      return true;
    });

    setPhotos(prev => [...prev, ...validFiles]);
    const urls = validFiles.map(file => URL.createObjectURL(file));
    setPreviewUrls(prev => [...prev, ...urls]);
  };

  const removePhoto = (index: number) => {
    URL.revokeObjectURL(previewUrls[index]);
    setPhotos(prev => prev.filter((_, i) => i !== index));
    setPreviewUrls(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title || !formData.description || !formData.category) {
      alert(tx('Please fill all required fields', 'कृपया सभी आवश्यक फ़ील्ड भरें'));
      return;
    }

    setSubmitting(true);
    setResult(null);

    const response = await submitReport({
      ...formData,
      coords: coords || undefined,
      photos
    });

    setSubmitting(false);
    setResult(response);

    if (response.success) {
      // Reset form
      setFormData({ title: '', description: '', category: '', location: '', district: '' });
      setPhotos([]);
      setPreviewUrls([]);
      setCoords(null);
    }
  };

  const copyToken = () => {
    if (result?.reporterToken) {
      navigator.clipboard.writeText(result.reporterToken);
      setTokenCopied(true);
      setTimeout(() => setTokenCopied(false), 2000);
    }
  };

  if (result?.success) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-6 text-center">
          <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">{tx('Report Submitted Successfully!', 'रिपोर्ट सफलतापूर्वक जमा हो गई!')}</h2>
          <p className="text-slate-400 mb-6">
            {tx('Your report has been anonymized and submitted. Save your tracking token to check the status.', 'आपकी रिपोर्ट अनामीकृत करके जमा कर दी गई है। स्थिति देखने के लिए अपना ट्रैकिंग टोकन सुरक्षित रखें।')}
          </p>
          
          <div className="bg-slate-800 rounded-xl p-4 mb-4">
            <div className="text-sm text-slate-400 mb-2">{tx('Report ID', 'रिपोर्ट आईडी')}</div>
            <div className="text-lg font-mono text-cyan-400">{result.reportId}</div>
          </div>

          <div className="bg-slate-800 rounded-xl p-4 mb-6">
            <div className="text-sm text-slate-400 mb-2">{tx('Your Tracking Token (Save this!)', 'आपका ट्रैकिंग टोकन (इसे सुरक्षित रखें!)')}</div>
            <div className="flex items-center justify-center gap-2">
              <div className="text-lg font-mono text-yellow-400 break-all">{result.reporterToken}</div>
              <button
                onClick={copyToken}
                className="p-2 rounded-lg hover:bg-slate-700 transition-colors"
              >
                {tokenCopied ? (
                  <CheckCircle className="w-5 h-5 text-green-400" />
                ) : (
                  <Copy className="w-5 h-5 text-slate-400" />
                )}
              </button>
            </div>
          </div>

          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 text-left">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-yellow-400 font-medium mb-1">{tx('Important!', 'महत्वपूर्ण!')}</div>
                <ul className="text-sm text-slate-300 space-y-1">
                  <li>{tx('• Save your tracking token - you\'ll need it to check status', '• अपना ट्रैकिंग टोकन सुरक्षित रखें - स्थिति जांचने के लिए इसकी जरूरत होगी')}</li>
                  <li>{tx('• You can escalate the report if not resolved in 7 days', '• 7 दिनों में समाधान न होने पर रिपोर्ट एस्केलेट कर सकते हैं')}</li>
                  <li>{tx('• Other citizens can vote on your report for credibility', '• विश्वसनीयता के लिए अन्य नागरिक आपकी रिपोर्ट पर वोट कर सकते हैं')}</li>
                </ul>
              </div>
            </div>
          </div>

          <button
            onClick={() => setResult(null)}
            className="mt-6 px-6 py-3 bg-cyan-500 text-white rounded-xl hover:bg-cyan-600 transition-colors"
          >
            {tx('Submit Another Report', 'एक और रिपोर्ट जमा करें')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-slate-800/50 rounded-2xl border border-slate-700 p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-cyan-500/20 rounded-xl">
            <Shield className="w-6 h-6 text-cyan-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">{tx('Submit Anonymous Report', 'गुमनाम रिपोर्ट जमा करें')}</h2>
            <p className="text-slate-400 text-sm">{tx('Your identity will be protected through AI anonymization', 'एआई अनामीकरण द्वारा आपकी पहचान सुरक्षित रहेगी')}</p>
          </div>
        </div>

        {/* Privacy Notice */}
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 mb-6">
          <div className="flex items-start gap-2">
            <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-slate-300">
              <span className="text-blue-400 font-medium">{tx('Privacy Protected: ', 'गोपनीयता सुरक्षित: ')}</span>
              {tx('Your report will be processed by AI to remove all personal information (names, phone numbers, addresses, etc.) while preserving the essential details of your complaint.', 'आपकी रिपोर्ट को एआई द्वारा प्रोसेस किया जाएगा ताकि सभी व्यक्तिगत जानकारी (नाम, फोन नंबर, पता आदि) हट जाए, और शिकायत का आवश्यक विवरण सुरक्षित रहे।')}
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Category Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-3">
              {tx('Issue Category', 'समस्या श्रेणी')} <span className="text-red-400">*</span>
            </label>
            <div className="grid grid-cols-3 gap-3">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, category: cat.id }))}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    formData.category === cat.id
                      ? 'border-cyan-500 bg-cyan-500/20'
                      : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                  }`}
                >
                  <div className="mb-1"><cat.icon size={20} className="shrink-0" /></div>
                  <div className="text-sm font-medium text-white">{cat.label[lang]}</div>
                  <div className="text-xs text-slate-500 mt-1">{cat.description[lang]}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              {tx('Issue Title', 'समस्या शीर्षक')} <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              placeholder={tx('Brief title describing the issue', 'समस्या का संक्षिप्त शीर्षक लिखें')}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              {tx('Detailed Description', 'विस्तृत विवरण')} <span className="text-red-400">*</span>
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder={tx('Describe the issue in detail. Include all relevant information - AI will remove any personal details automatically.', 'समस्या का विस्तृत विवरण दें। सभी प्रासंगिक जानकारी शामिल करें - एआई व्यक्तिगत जानकारी स्वतः हटा देगा।')}
              rows={5}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 resize-none"
            />
            <p className="text-xs text-slate-500 mt-1">
              {tx('Feel free to include names, dates, and specific details - they will be anonymized automatically.', 'आप नाम, तारीख और विशेष विवरण लिख सकते हैं - इन्हें स्वतः अनामीकृत कर दिया जाएगा।')}
            </p>
          </div>

          {/* Location */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                {tx('Area/Locality', 'क्षेत्र/इलाका')}
              </label>
              <input
                type="text"
                name="location"
                value={formData.location}
                onChange={handleInputChange}
                placeholder={tx('e.g., Main Market Area', 'जैसे, मुख्य बाजार क्षेत्र')}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                {tx('District', 'जिला')}
              </label>
              <input
                type="text"
                name="district"
                value={formData.district}
                onChange={handleInputChange}
                placeholder={tx('e.g., Pune', 'जैसे, पुणे')}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          {/* GPS Location */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              {tx('GPS Location (Optional)', 'जीपीएस स्थान (वैकल्पिक)')}
            </label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={detectLocation}
                disabled={detecting}
                className="flex items-center gap-2 px-4 py-2 bg-slate-700 rounded-xl text-slate-300 hover:bg-slate-600 transition-colors disabled:opacity-50"
              >
                {detecting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <MapPin className="w-4 h-4" />
                )}
                {detecting ? tx('Detecting...', 'पता लगाया जा रहा है...') : tx('Detect Location', 'स्थान पहचानें')}
              </button>
              {coords && (
                <span className="inline-flex items-center gap-1 text-sm text-green-400">
                  <CheckCircle size={14} />
                  {tx('Location detected (generalized for privacy)', 'स्थान मिला (गोपनीयता हेतु सामान्यीकृत)')}
                </span>
              )}
            </div>
          </div>

          {/* Photos */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              {tx('Photos (Optional, max 3)', 'फोटो (वैकल्पिक, अधिकतम 3)')}
            </label>
            <div className="flex flex-wrap gap-3">
              {previewUrls.map((url, index) => (
                <div key={index} className="relative">
                  <img
                    src={url}
                    alt={`Preview ${index + 1}`}
                    className="w-24 h-24 object-cover rounded-xl border border-slate-700"
                  />
                  <button
                    type="button"
                    onClick={() => removePhoto(index)}
                    className="absolute -top-2 -right-2 p-1 bg-red-500 rounded-full text-white"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {photos.length < 3 && (
                <label className="w-24 h-24 flex flex-col items-center justify-center border-2 border-dashed border-slate-700 rounded-xl cursor-pointer hover:border-cyan-500 transition-colors">
                  <Camera className="w-6 h-6 text-slate-500" />
                  <span className="text-xs text-slate-500 mt-1">{tx('Add Photo', 'फोटो जोड़ें')}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </label>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-2">
              {tx('Photo metadata will be stripped for privacy', 'गोपनीयता हेतु फोटो मेटाडेटा हटाया जाएगा')}
            </p>
          </div>

          {/* Error */}
          {result?.error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400">
              {result.error}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={submitting || !formData.title || !formData.description || !formData.category}
            className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-xl font-medium hover:from-cyan-600 hover:to-blue-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {tx('Processing & Anonymizing...', 'प्रोसेसिंग और अनामीकरण...')}
              </>
            ) : (
              <>
                <Send className="w-5 h-5" />
                {tx('Submit Anonymous Report', 'गुमनाम रिपोर्ट जमा करें')}
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
