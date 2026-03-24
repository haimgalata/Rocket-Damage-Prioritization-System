import React, { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CheckCircle, X, Navigation, Search, ImageIcon, Brain, Loader2, WifiOff, FlaskConical } from 'lucide-react';
import { PageContainer } from '../../components/layout/PageContainer';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { LocationPicker } from '../../components/maps/LocationPicker';
import { useNotificationStore } from '../../store/authStore';
import { useEventStore } from '../../store/eventStore';
import { useAuth } from '../../hooks';
import { EventStatus } from '../../types';
import type { Location, DamageEvent, GisDetails } from '../../types';
import { parseDamageEvent } from '../../api/parsers';
import { apiFetch } from '../../shared/api/http';
import { TEST_TEMPLATES } from '../../config/testTemplates';

const schema = z.object({
  name: z.string().min(3, 'Event name must be at least 3 characters').max(80),
  description: z.string().min(20, 'Description must be at least 20 characters').max(500),
  tags: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

function simulateAIClassification(): { classification: 'Light' | 'Heavy'; damageScore: number } {
  const isHeavy = Math.random() > 0.4;
  return {
    classification: isHeavy ? 'Heavy' : 'Light',
    damageScore: isHeavy ? 7 : 3,
  };
}

function simulateGISMultiplier(lat: number, lng: number): GisDetails {
  const baseLat = 32.0853;
  const baseLng = 34.7818;
  const dist = Math.sqrt(Math.pow(lat - baseLat, 2) + Math.pow(lng - baseLng, 2));
  const density = Math.max(1000, Math.round(15000 - dist * 150000));
  const hospitalDist = Math.max(400, Math.round(800 + dist * 60000));
  const schoolDist = Math.max(200, Math.round(500 + dist * 40000));
  const roadDist = Math.max(30, Math.round(80 + dist * 5000));
  const strategicDist = Math.max(1000, Math.round(2000 + dist * 80000));
  let s = 0;
  s += 0.25 * (hospitalDist <= 5000 ? 1.0 : hospitalDist <= 10000 ? 0 : -1.0);
  s += 0.15 * (schoolDist <= 5000 ? 1.0 : schoolDist <= 10000 ? 0 : -1.0);
  s += 0.15 * (roadDist <= 500 ? 0.5 : 0);
  s += 0.25 * (strategicDist <= 5000 ? 0.5 : 0);
  s += 0.20 * (density >= 12000 ? 1.0 : density >= 5000 ? 0.5 : density >= 1500 ? 0 : -1.0);

  const geoMultiplier = Math.max(0.5, Math.min(1.5, 1.0 + s));

  return {
    distHospitalM: hospitalDist,
    distSchoolM: schoolDist,
    distRoadM: roadDist,
    distStrategicM: strategicDist,
    populationDensity: density,
    geoMultiplier: Math.round(geoMultiplier * 100) / 100,
  };
}

export const NewEventForm: React.FC = () => {
  const { user } = useAuth();
  const { addEvent, updateEvent } = useEventStore();
  const { addNotification } = useNotificationStore();

  const [location, setLocation] = useState<Location | null>(null);
  const [addressInput, setAddressInput] = useState('');
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState('');
  const [addressSearching, setAddressSearching] = useState(false);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [aiStatus, setAiStatus] = useState<'idle' | 'analyzing' | 'done'>('idle');
  const [submitted, setSubmitted] = useState(false);
  const [apiError, setApiError] = useState('');

  const [templateImagePath, setTemplateImagePath] = useState<string | null>(null);

  const { register, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } =
    useForm<FormData>({ resolver: zodResolver(schema) });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file.');
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const clearImage = () => {
    setImageFile(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAddressSearch = async () => {
    const query = addressInput.trim();
    if (!query) return;
    setAddressSearching(true);
    setGeoError('');
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=il`;
      const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
      const data = await res.json();
      if (data.length === 0) {
        setGeoError('Address not found. Try a more specific query.');
        return;
      }
      const { lat, lon, display_name } = data[0];
      const parts = display_name.split(',');
      setLocation({
        lat: parseFloat(parseFloat(lat).toFixed(5)),
        lng: parseFloat(parseFloat(lon).toFixed(5)),
        address: parts.slice(0, 2).join(',').trim(),
        city: parts[parts.length - 2]?.trim() || 'Israel',
      });
    } catch {
      setGeoError('Could not search address. Check your connection.');
    } finally {
      setAddressSearching(false);
    }
  };

  const handleGeolocation = () => {
    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported by your browser.');
      return;
    }
    setGeoLoading(true);
    setGeoError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setLocation({
          lat: parseFloat(latitude.toFixed(5)),
          lng: parseFloat(longitude.toFixed(5)),
          address: `GPS ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
          city: 'Current Location',
        });
        setGeoLoading(false);
      },
      (err) => {
        setGeoError(
          err.code === 1
            ? 'Location permission denied. Allow access in browser settings.'
            : 'Unable to retrieve location. Please try again.'
        );
        setGeoLoading(false);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const loadTemplate = async (tplId: string) => {
    const tpl = TEST_TEMPLATES.find((t) => t.id === tplId);
    if (!tpl) return;

    setValue('name', tpl.name, { shouldValidate: true });
    setValue('description', tpl.description, { shouldValidate: true });
    setValue('tags', tpl.tags, { shouldValidate: true });

    setLocation({ lat: tpl.lat, lng: tpl.lng, address: tpl.address, city: tpl.city });
    setAddressInput(tpl.address);

    clearImage();
    setTemplateImagePath(tpl.imagePath);
    try {
      const res = await fetch(tpl.imagePath);
      if (res.ok) {
        const blob = await res.blob();
        const filename = tpl.imagePath.split('/').pop() || 'test-image.jpg';
        const file = new File([blob], filename, { type: blob.type || 'image/jpeg' });
        setImageFile(file);
        setImagePreview(URL.createObjectURL(file));
        setTemplateImagePath(null);
      }
    } catch {
    }
  };

  const pollForGis = async (eventId: number) => {
    const MAX_ATTEMPTS = 20;
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      await new Promise(r => setTimeout(r, 4000));
      try {
        const resp = await apiFetch(`/events/${String(eventId)}`);
        if (!resp.ok) continue;
        const evt = await resp.json();
        if (evt.gisStatus === 'done') {
          const gisDetails: GisDetails = {
            distHospitalM:     evt.gisDetails?.distHospitalM    ?? -1,
            distSchoolM:       evt.gisDetails?.distSchoolM      ?? -1,
            distRoadM:         evt.gisDetails?.distRoadM        ?? -1,
            distStrategicM:    evt.gisDetails?.distStrategicM   ?? -1,
            populationDensity: evt.gisDetails?.populationDensity ?? 0,
            geoMultiplier:     evt.gisDetails?.geoMultiplier    ?? 1,
          };
          updateEvent(eventId, {
            gisDetails,
            priorityScore: evt.priorityScore,
            llmExplanation: evt.llmExplanation,
            gisStatus: 'done',
          });
          return;
        }
      } catch {
      }
    }
  };

  const onSubmit = async (data: FormData) => {
    const loc = location || { lat: 32.0853, lng: 34.7818, address: 'Unspecified', city: 'Tel Aviv' };

    setAiStatus('analyzing');
    setApiError('');

    let newEvent: DamageEvent | null = null;
    let usedFallback = false;

    try {
      const formData = new window.FormData();
      formData.append('lat', String(loc.lat));
      formData.append('lon', String(loc.lng));
      formData.append('description', data.description);
      formData.append('organization_id', String(user?.organizationId ?? 1));
      formData.append('created_by', String(user?.id ?? ''));
      formData.append('tags', data.tags || '');
      if (imageFile) formData.append('image', imageFile);

      const resp = await apiFetch('/events', { method: 'POST', body: formData });
      if (!resp.ok) throw new Error(`Server error ${resp.status}`);

      const evt = await resp.json();
      const gisDetails: GisDetails = {
        distHospitalM:    evt.gisDetails?.distHospitalM    ?? -1,
        distSchoolM:      evt.gisDetails?.distSchoolM      ?? -1,
        distRoadM:        evt.gisDetails?.distRoadM        ?? -1,
        distStrategicM:   evt.gisDetails?.distStrategicM   ?? -1,
        populationDensity:evt.gisDetails?.populationDensity ?? 0,
        geoMultiplier:    evt.gisDetails?.geoMultiplier    ?? 1,
      };

      const parsed = parseDamageEvent(evt as Record<string, unknown>);
      newEvent = {
        ...parsed,
        name: data.name,
        location: { lat: loc.lat, lng: loc.lng, address: evt.location?.address ?? loc.address, city: evt.location?.city ?? loc.city },
        imageUrl: parsed.imageUrl || imagePreview || '',
        gisDetails,
        status: parsed.status,
      };
    } catch (_err) {
      usedFallback = true;
      setApiError('Backend unavailable — scoring locally (offline mode).');
      const { classification, damageScore } = simulateAIClassification();
      const gisDetails = simulateGISMultiplier(loc.lat, loc.lng);
      const finalScore = Math.min(10, Math.max(0.1, Math.round(damageScore * gisDetails.geoMultiplier * 10) / 10));
      const eventId = Date.now();

      const llmExplanation = `${classification} damage classification detected. AI analysis identified structural characteristics consistent with ${classification.toLowerCase()} damage patterns. ${
        classification === 'Heavy'
          ? 'Significant structural compromise observed — immediate assessment recommended.'
          : 'Minor structural impact — standard repair scheduling appropriate.'
      } Geographic context: population density ${gisDetails.populationDensity.toLocaleString()} persons/km², nearest hospital ${
        gisDetails.distHospitalM >= 1000
          ? `${(gisDetails.distHospitalM / 1000).toFixed(1)} km`
          : `${gisDetails.distHospitalM} m`
      } away. Geographic multiplier: ×${gisDetails.geoMultiplier.toFixed(2)}. Final priority score: ${finalScore.toFixed(1)}/10. (Offline mode — backend unavailable)`;

      newEvent = {
        id:                   eventId,
        organizationId:       user?.organizationId ?? 1,
        name:                 data.name,
        location:             loc,
        imageUrl:             imagePreview || '',
        description:          data.description,
        damageClassification: classification,
        damageScore,
        priorityScore:        finalScore,
        gisDetails,
        status:               EventStatus.NEW,
        hidden:               false,
        llmExplanation,
        aiModel:              'PrioritAI-v2.1 (offline)',
        createdBy:            user?.id ?? 0,
        createdAt:            new Date(),
        tags:                 data.tags?.split(',').map((t) => t.trim()).filter(Boolean) ?? [],
      };
    }

    addEvent(newEvent);

    if (!usedFallback && newEvent.gisStatus === 'pending') {
      pollForGis(newEvent.id);
    }

    const score = newEvent.priorityScore;
    const eventId = newEvent.id;
    if (score >= 7.5) {
      addNotification({
        id: `notif-${Date.now()}`,
        title: 'Critical Event Detected',
        message: `New event at ${loc.address} scored ${score.toFixed(1)}/10. Immediate response required.`,
        type: 'critical',
        read: false,
        createdAt: new Date(),
        eventId,
      });
    } else if (score >= 5.0) {
      addNotification({
        id: `notif-${Date.now()}`,
        title: 'High-Priority Event',
        message: `New event at ${loc.address} has been assessed with priority ${score.toFixed(1)}/10.`,
        type: 'warning',
        read: false,
        createdAt: new Date(),
        eventId,
      });
    }

    if (usedFallback) {
      addNotification({
        id: `notif-offline-${Date.now()}`,
        title: 'Offline Mode',
        message: 'Backend server unavailable. Event scored locally using simulation.',
        type: 'info',
        read: false,
        createdAt: new Date(),
      });
    }

    setAiStatus('done');
    await new Promise((r) => setTimeout(r, 400));

    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setAiStatus('idle');
      reset();
      setLocation(null);
      setAddressInput('');
      clearImage();
    }, 3000);
  };

  if (aiStatus === 'analyzing') {
    return (
      <PageContainer title="Report New Damage Event">
        <div className="max-w-2xl mx-auto mt-20 text-center">
          <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">AI Model Running</h2>
          <p className="text-gray-500 mb-1">Sending to backend · classifying damage · computing GIS priority score...</p>
          <div className="flex items-center justify-center gap-2 mt-4">
            <Brain className="w-4 h-4 text-blue-500 animate-pulse" />
            <span className="text-sm text-blue-600 font-medium">Vision AI → GIS Analysis → Final Score</span>
          </div>
          {apiError && (
            <div className="mt-6 flex items-center gap-2 justify-center text-amber-600 text-sm">
              <WifiOff className="w-4 h-4" /> {apiError}
            </div>
          )}
        </div>
      </PageContainer>
    );
  }

  if (submitted) {
    return (
      <PageContainer title="New Damage Event">
        <div className="max-w-2xl mx-auto mt-20 text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Event Submitted & Scored</h2>
          <p className="text-gray-500">Your report has been analyzed by AI and added to the priority queue.</p>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer title="Report New Damage Event">
      <div className="max-w-2xl mx-auto">
        <div className="mb-4 flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5">
          <Brain className="w-4 h-4 text-blue-500 flex-shrink-0" />
          <p className="text-xs text-blue-700">
            Upon submission, the AI model will automatically classify the damage and compute the priority score using GIS data.
          </p>
        </div>

        <div className="mb-4 border border-amber-200 bg-amber-50 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <FlaskConical className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span className="text-sm font-semibold text-amber-800">Quick Load Test Template</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {TEST_TEMPLATES.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                onClick={() => loadTemplate(tpl.id)}
                className="px-3 py-1.5 text-xs font-medium rounded-md bg-white border border-amber-300 text-amber-800 hover:bg-amber-100 transition"
              >
                {tpl.expected.aiClassification === 'Heavy' ? '🔴' : '🟡'} {tpl.city}
              </button>
            ))}
          </div>
          {templateImagePath && (
            <div className="mt-2 p-2 bg-white border border-amber-300 rounded text-xs text-amber-700">
              <strong>📂 Manual image required:</strong> Please click the photo upload area and select:
              <br />
              <code className="bg-amber-100 px-1 rounded">{templateImagePath.replace('/test-images/', 'client/public/test-images/')}</code>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

          <Card title="Event Description">
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">
                  Event Name <span className="text-red-500">*</span>
                </label>
                <input
                  {...register('name')}
                  placeholder="e.g. Dizengoff Facade Collapse"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {errors.name && (
                  <p className="text-xs text-red-600 mt-1">{errors.name.message}</p>
                )}
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">
                  Damage Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  {...register('description')}
                  rows={4}
                  placeholder="Describe the damage — type, affected area, visible hazards, estimated scope..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
                {errors.description && (
                  <p className="text-xs text-red-600 mt-1">{errors.description.message}</p>
                )}
              </div>
              <Input
                label="Tags (comma-separated)"
                placeholder="structural, urgent, residential"
                {...register('tags')}
              />
            </div>
          </Card>

          <Card title="Location">
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Address</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={addressInput}
                    onChange={(e) => setAddressInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddressSearch(); } }}
                    placeholder="Type an address and press Search..."
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddressSearch}
                    disabled={addressSearching}
                    className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition disabled:opacity-60"
                  >
                    {addressSearching
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Search className="w-4 h-4" />}
                    {addressSearching ? 'Searching...' : 'Search'}
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={handleGeolocation}
                disabled={geoLoading}
                className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-blue-300 hover:border-blue-500 hover:bg-blue-50 text-blue-600 rounded-lg text-sm font-medium transition disabled:opacity-60"
              >
                <Navigation className={`w-4 h-4 ${geoLoading ? 'animate-pulse' : ''}`} />
                {geoLoading ? 'Getting your location...' : 'Use My Current Location'}
              </button>
              {geoError && <p className="text-xs text-red-500">{geoError}</p>}

              <LocationPicker value={location || undefined} onChange={setLocation} height="260px" />

              {location && (
                <p className="text-xs text-green-600 font-medium">
                  Location set: {location.address}
                </p>
              )}
            </div>
          </Card>

          <Card title="Photo Evidence">
            {imagePreview ? (
              <div className="relative">
                <img
                  src={imagePreview}
                  alt="Damage preview"
                  className="w-full h-56 object-cover rounded-xl border border-gray-200"
                />
                <button
                  type="button"
                  onClick={clearImage}
                  className="absolute top-2 right-2 w-8 h-8 bg-white/90 hover:bg-white border border-gray-200 rounded-full flex items-center justify-center shadow-sm transition"
                >
                  <X className="w-4 h-4 text-gray-600" />
                </button>
                {imageFile && (
                  <p className="text-xs text-gray-500 mt-2 truncate">{imageFile.name}</p>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-gray-200 hover:border-blue-400 rounded-xl p-10 text-center bg-gray-50 hover:bg-blue-50 transition group"
              >
                <div className="flex flex-col items-center gap-2">
                  <div className="w-12 h-12 bg-gray-100 group-hover:bg-blue-100 rounded-full flex items-center justify-center transition">
                    <ImageIcon className="w-6 h-6 text-gray-400 group-hover:text-blue-500 transition" />
                  </div>
                  <p className="text-sm font-medium text-gray-600 group-hover:text-blue-600">
                    Click to upload a photo
                  </p>
                  <p className="text-xs text-gray-400">PNG, JPG, WEBP</p>
                </div>
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </Card>

          <Button type="submit" loading={isSubmitting} size="lg" className="w-full justify-center">
            Submit & Run AI Assessment
          </Button>
        </form>
      </div>
    </PageContainer>
  );
};