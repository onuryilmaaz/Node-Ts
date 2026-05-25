export type TaskType =
  | "prayer"
  | "quran"
  | "dua"
  | "dhikr"
  | "wudu"
  | "memorization"
  | "manners"
  | "custom";

export type Recurrence = "daily" | "weekly" | "once";

export type CompletionStatus = "pending" | "approved" | "rejected";

export interface ChildProfile {
  id: string;
  parent_id: string;
  name: string;
  birth_year: number | null;
  avatar_emoji: string;
  gender: "erkek" | "kız" | null;
  is_active: boolean;
  created_at: string;
}

export interface ChildStats {
  child_id: string;
  total_stars: number;
  current_streak: number;
  highest_streak: number;
  level: number;
  last_activity: string | null;
}

export interface ChildTask {
  id: string;
  child_id: string;
  parent_id: string;
  task_type: TaskType;
  title: string;
  description: string | null;
  recurrence: Recurrence;
  scheduled_days: number[] | null;
  due_time: string | null;
  reward_stars: number;
  requires_proof: boolean;
  requires_approval: boolean;
  is_active: boolean;
  created_at: string;
}

export interface TaskCompletion {
  id: string;
  task_id: string;
  child_id: string;
  completion_date: string;
  completed_at: string;
  status: CompletionStatus;
  evidence_url: string | null;
  parent_note: string | null;
  reviewed_at: string | null;
  stars_earned: number;
}

export interface ChildBadge {
  id: string;
  child_id: string;
  badge_type: string;
  earned_at: string;
}

export interface ChildReward {
  id: string;
  child_id: string;
  title: string;
  cost_stars: number;
  is_redeemed: boolean;
  redeemed_at: string | null;
  created_at: string;
}

export interface TaskTemplate {
  task_type: TaskType;
  title: string;
  description: string;
  reward_stars: number;
  requires_approval: boolean;
}

export const CHILD_BADGE_DETAILS: Record<
  string,
  { name: string; description: string; emoji: string }
> = {
  ilk_adim: { name: "İlk Adım", description: "İlk görevini tamamladın!", emoji: "⭐" },
  hafiza_baslangic: { name: "Hafız Adayı", description: "5 ayet ezberledin", emoji: "📖" },
  namaz_srk_3: { name: "3 Gün Namaz", description: "3 gün üst üste namaz kıldın", emoji: "🕌" },
  namaz_srk_7: { name: "7 Gün Namaz", description: "7 gün üst üste namaz kıldın", emoji: "🌟" },
  namaz_srk_30: { name: "30 Gün Namaz", description: "30 gün üst üste namaz kıldın", emoji: "🏆" },
  sabah_kusucugu: { name: "Sabah Kuşu", description: "7 gün sabah namazı", emoji: "🌅" },
  quran_coku: { name: "Kuran Sevdalısı", description: "50 sayfa Kuran okudun", emoji: "📚" },
  dua_ustasi: { name: "Dua Ustası", description: "10 dua öğrendin", emoji: "🤲" },
  hafta_tam: { name: "Mükemmel Hafta", description: "Bir hafta tam tamamladın", emoji: "💎" },
  ay_tam: { name: "Mükemmel Ay", description: "Bir ay tam tamamladın", emoji: "👑" },
  iyi_ahlak: { name: "İyi Ahlak", description: "20 adab görevi tamamladın", emoji: "😇" },
};

export const CHILD_LEVELS = [
  { level: 1, name: "Minik Mümin", min_stars: 0, max_stars: 19 },
  { level: 2, name: "Küçük Talip", min_stars: 20, max_stars: 49 },
  { level: 3, name: "Güzel Ahlaklı", min_stars: 50, max_stars: 99 },
  { level: 4, name: "Namaz Dostu", min_stars: 100, max_stars: 179 },
  { level: 5, name: "Kuran Sevdalısı", min_stars: 180, max_stars: 279 },
  { level: 6, name: "Dua Ustası", min_stars: 280, max_stars: 399 },
  { level: 7, name: "Saliha Çocuk", min_stars: 400, max_stars: 549 },
  { level: 8, name: "Hafız Adayı", min_stars: 550, max_stars: 729 },
  { level: 9, name: "Nur Yüzlü", min_stars: 730, max_stars: 949 },
  { level: 10, name: "Efsane Mümin", min_stars: 950, max_stars: Infinity },
];

export const TASK_TEMPLATES: TaskTemplate[] = [
  { task_type: "prayer", title: "Sabah Namazı", description: "Sabah namazını kıl", reward_stars: 2, requires_approval: false },
  { task_type: "prayer", title: "Öğle Namazı", description: "Öğle namazını kıl", reward_stars: 1, requires_approval: false },
  { task_type: "prayer", title: "İkindi Namazı", description: "İkindi namazını kıl", reward_stars: 1, requires_approval: false },
  { task_type: "prayer", title: "Akşam Namazı", description: "Akşam namazını kıl", reward_stars: 1, requires_approval: false },
  { task_type: "prayer", title: "Yatsı Namazı", description: "Yatsı namazını kıl", reward_stars: 1, requires_approval: false },
  { task_type: "wudu", title: "Abdest Al", description: "Her namaz için abdest al", reward_stars: 1, requires_approval: false },
  { task_type: "quran", title: "Kuran Oku", description: "Bugün en az 1 sayfa Kuran oku", reward_stars: 2, requires_approval: true },
  { task_type: "memorization", title: "Ayet Ezberle", description: "Bugün yeni bir ayet ezberle", reward_stars: 3, requires_approval: true },
  { task_type: "dua", title: "Sabah Duası", description: "Sabah uyanınca sabah duasını oku", reward_stars: 1, requires_approval: false },
  { task_type: "dua", title: "Yemek Duası", description: "Yemekten önce ve sonra dua et", reward_stars: 1, requires_approval: false },
  { task_type: "dua", title: "Uyku Duası", description: "Uyumadan önce uyku duasını oku", reward_stars: 1, requires_approval: false },
  { task_type: "dhikr", title: "Tesbih Çek", description: "33 kez Sübhanallah, Elhamdülillah, Allahuekber", reward_stars: 1, requires_approval: false },
  { task_type: "manners", title: "Büyüklere Saygı", description: "Büyüklere saygı göster, ellerini öp", reward_stars: 1, requires_approval: true },
  { task_type: "manners", title: "Selam Ver", description: "Evde ve dışarıda selam ver", reward_stars: 1, requires_approval: false },
  { task_type: "manners", title: "Yemek Adabı", description: "Sağ elle ye, besmele çek", reward_stars: 1, requires_approval: false },
];
