/* ------------------------------------------------------------------
   Showreel projects: the only file you edit to change the 3D carousel.

   VIDEOS   work/videos/<name>.mp4   16:9, muted is fine, 6-15 s loop,
                                     1280x720 H.264, under ~4 MB each.
   POSTERS  work/posters/<name>.jpg  one still frame of the same video,
                                     1280x720, shown until the video plays.

   One entry per project:
     cat     'commercial' | 'live'   (which filter tab it sits in; to bring Music back, add its tab and entries)
     title   project title, English and Arabic
     client  client name (shown in the serif line under the title)
     role    what you did, English and Arabic
     video   path to the mp4, or null for a placeholder card
     poster  path to the jpg, or null
     link    optional page to open from the project view (Instagram, YouTube)

   Until your 16:9 files arrive, the commercial and live cards use the
   vertical reel previews already on the site (centre-cropped to 16:9).
------------------------------------------------------------------ */
window.WORK_TABS = [
  { id: 'all',        en: 'All',                    ar: 'الكل' },
  { id: 'commercial', en: 'Commercial & Branded',   ar: 'إعلانات وعلامات' },
  { id: 'live',       en: 'Live',                   ar: 'مباشر' }
];

window.WORK_PROJECTS = [
  { cat: 'commercial', title: { en: 'KFAS headquarters', ar: 'مقر KFAS' }, client: 'KFAS', role: { en: 'FPV fly-through', ar: 'جولة درون FPV' }, video: 'work/videos/kfas.mp4', poster: 'work/posters/kfas.jpg', link: null },
  { cat: 'commercial', title: { en: 'Hessah', ar: 'Hessah' }, client: 'Hessah', role: { en: 'FPV fly-through', ar: 'جولة درون FPV' }, video: 'work/videos/hessa-hero.mp4', poster: 'work/posters/hessa.jpg', link: null },
  { cat: 'commercial', title: { en: 'Barbacoa × Gardenia', ar: 'Barbacoa × Gardenia' }, client: 'Barbacoa', role: { en: 'Reel · iPhone', ar: 'ريل · آيفون' }, video: 'previews/DTp4xjDiJ1I.mp4', poster: 'covers/DTp4xjDiJ1I.jpg', link: 'https://www.instagram.com/barbacoa.kw/reel/DTp4xjDiJ1I/' },
  { cat: 'commercial', title: { en: 'Winter Wonderland', ar: 'Winter Wonderland' }, client: 'KFH', role: { en: 'Campaign reel', ar: 'ريل حملة' }, video: 'previews/DQwHpBVjM88.mp4', poster: 'covers/DQwHpBVjM88.jpg', link: 'https://www.instagram.com/alaa.alsafii/reel/DQwHpBVjM88/' },
  { cat: 'commercial', title: { en: 'Burger King', ar: 'برجر كنج' }, client: 'Burger King Kuwait', role: { en: 'Food reel', ar: 'ريل طعام' }, video: 'previews/DQOxGW1DDtg.mp4', poster: 'covers/DQOxGW1DDtg.jpg', link: 'https://www.instagram.com/alaa.alsafii/reel/DQOxGW1DDtg/' },
  { cat: 'commercial', title: { en: 'Shake Shack × Az', ar: 'Shake Shack × Az' }, client: 'Shake Shack', role: { en: 'Collab reel', ar: 'ريل تعاون' }, video: 'previews/DPWiNmXDHia.mp4', poster: 'covers/DPWiNmXDHia.jpg', link: 'https://www.instagram.com/alaa.alsafii/reel/DPWiNmXDHia/' },
  { cat: 'commercial', title: { en: 'Awtad Residence', ar: 'أوتاد ريزيدنس' }, client: 'Awtad Real Estate', role: { en: 'FPV walkthrough', ar: 'جولة درون FPV' }, video: 'previews/DQc2JLBDJci.mp4', poster: 'covers/DQc2JLBDJci.jpg', link: 'https://www.instagram.com/awtad.realestate/reel/DQc2JLBDJci/' },
  { cat: 'commercial', title: { en: 'Bay Zero summer', ar: 'صيف Bay Zero' }, client: 'Bay Zero', role: { en: 'Brand reel', ar: 'ريل علامة' }, video: 'previews/DOEA-O2jEHF.mp4', poster: 'covers/DOEA-O2jEHF.jpg', link: 'https://www.instagram.com/bayzero.kw/reel/DOEA-O2jEHF/' },
  { cat: 'commercial', title: { en: 'Salt Eidiya', ar: 'عيدية SALT' }, client: 'SALT', role: { en: 'Eid campaign', ar: 'حملة العيد' }, video: 'previews/DKjzZ94snr4.mp4', poster: 'covers/DKjzZ94snr4.jpg', link: 'https://www.instagram.com/findsalt.kuwait/reel/DKjzZ94snr4/' },


  { cat: 'live', title: { en: 'Tournament day two', ar: 'اليوم الثاني من البطولة' }, client: 'The Padel League', role: { en: 'Event coverage', ar: 'تغطية فعالية' }, video: 'previews/DSipWF8DNuc.mp4', poster: 'covers/DSipWF8DNuc.jpg', link: 'https://www.instagram.com/the.padel.league/reel/DSipWF8DNuc/' },
  { cat: 'live', title: { en: 'Semi-final', ar: 'نصف النهائي' }, client: 'The Padel League', role: { en: 'Event coverage', ar: 'تغطية فعالية' }, video: 'previews/DRVQUlHDqvK.mp4', poster: 'covers/DRVQUlHDqvK.jpg', link: 'https://www.instagram.com/the.padel.league/reel/DRVQUlHDqvK/' },
  { cat: 'live', title: { en: 'Unforgettable · Tier 1', ar: 'لا يُنسى · المستوى الأول' }, client: 'The Padel League', role: { en: 'Event recap', ar: 'ملخص فعالية' }, video: 'previews/DSyMenaDBvi.mp4', poster: 'covers/DSyMenaDBvi.jpg', link: 'https://www.instagram.com/the.padel.league/reel/DSyMenaDBvi/' },
  { cat: 'live', title: { en: 'Padel, more than a sport', ar: 'البادل أكثر من رياضة' }, client: 'The Padel League', role: { en: 'Event film', ar: 'فيلم فعالية' }, video: 'previews/DSqWX8ajGv3.mp4', poster: 'covers/DSqWX8ajGv3.jpg', link: 'https://www.instagram.com/the.padel.league/reel/DSqWX8ajGv3/' }
];
