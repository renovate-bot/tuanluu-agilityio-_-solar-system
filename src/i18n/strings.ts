import type { Lang } from '../data/types';

// UI strings. Keys are flat dotted strings ('tour.start'). The English table is
// the source of the key set: add a key here first, then TypeScript requires the
// same key in the Vietnamese table. Placeholders use {name} syntax.
const EN = {
  appTitle: 'Solar System Explorer',
  hintDesktop: 'Click a body to fly to it · drag to orbit · scroll to zoom',
  hintMobile: 'Tap a body to fly to it · drag to rotate · pinch to zoom',
  backToOverview: 'Back to overview',
  notToScale: 'Sizes and distances are not to scale',

  'sound.on': 'Sound on',
  'sound.off': 'Sound off',

  'tour.start': 'Start tour',
  'tour.stop': 'Stop tour',
  'tour.pause': 'Pause',
  'tour.resume': 'Resume',
  'tour.next': 'Next',
  'tour.prev': 'Previous',
  'tour.exit': 'Exit tour',
  'tour.progress': 'Stop {current} of {total}',
  'tour.unmuteHint': 'Turn on sound to hear the narration',

  'credits.title': 'Credits',
  'credits.textures': 'Textures: Solar System Scope (CC BY 4.0)',
  'credits.data': 'Data: NASA Planetary Fact Sheet and NASA Science',
  'credits.voice': 'Narration voice generated with Microsoft Edge TTS',
  'credits.support': 'Buy me a coffee',
  'credits.close': 'Close',

  loading: 'Loading the Solar System…',
  'error.boot': 'Something went wrong while starting the app. Please reload the page.',
  webglUnsupported:
    'Your browser or device does not support WebGL, which is needed to show the Solar System.',

  'field.kind': 'Type',
  'field.order': 'Order from the Sun',
  'field.diameter': 'Diameter',
  'field.mass': 'Mass (Earth = 1)',
  'field.distance': 'Average distance from the Sun',
  'field.orbitalPeriod': 'Orbital period',
  'field.rotationPeriod': 'Rotation period',
  'field.meanTemp': 'Mean temperature',
  'field.moons': 'Known moons',
  'field.gravity': 'Surface gravity',

  'field.distanceEarth': 'Average distance from Earth',
  'unit.km': 'km',
  'unit.millionKm': 'million km',
  'unit.days': 'days',
  'unit.years': 'years',
  'unit.hours': 'hours',
  'unit.earthMass': '× Earth',
  'unit.retrograde': '(retrograde)',
  'panel.order': '{kind} #{n}',
  'panel.facts': 'Fun facts',

  'kind.star': 'Star',
  'kind.terrestrial': 'Terrestrial planet',
  'kind.gas-giant': 'Gas giant',
  'kind.ice-giant': 'Ice giant',
  'kind.dwarf-planet': 'Dwarf planet',
  'kind.moon': 'Moon',

  'lang.switch': 'Switch language',
} as const;

export type UiKey = keyof typeof EN;

const VI: Record<UiKey, string> = {
  appTitle: 'Khám phá Hệ Mặt Trời',
  hintDesktop: 'Nhấp vào một thiên thể để bay tới · kéo để xoay · cuộn để phóng to',
  hintMobile: 'Chạm vào một thiên thể để bay tới · kéo để xoay · chụm hai ngón để phóng to',
  backToOverview: 'Về toàn cảnh',
  notToScale: 'Kích thước và khoảng cách không theo đúng tỉ lệ',

  'sound.on': 'Bật âm thanh',
  'sound.off': 'Tắt âm thanh',

  'tour.start': 'Bắt đầu tour',
  'tour.stop': 'Dừng tour',
  'tour.pause': 'Tạm dừng',
  'tour.resume': 'Tiếp tục',
  'tour.next': 'Tiếp',
  'tour.prev': 'Trước',
  'tour.exit': 'Thoát tour',
  'tour.progress': 'Điểm dừng {current}/{total}',
  'tour.unmuteHint': 'Bật âm thanh để nghe thuyết minh',

  'credits.title': 'Thông tin',
  'credits.textures': 'Texture: Solar System Scope (CC BY 4.0)',
  'credits.data': 'Dữ liệu: NASA Planetary Fact Sheet và NASA Science',
  'credits.voice': 'Giọng thuyết minh được tạo bằng Microsoft Edge TTS',
  'credits.support': 'Buy me a coffee',
  'credits.close': 'Đóng',

  loading: 'Đang tải Hệ Mặt Trời…',
  'error.boot': 'Đã có lỗi khi khởi động ứng dụng. Vui lòng tải lại trang.',
  webglUnsupported:
    'Trình duyệt hoặc thiết bị của bạn không hỗ trợ WebGL, cần có để hiển thị Hệ Mặt Trời.',

  'field.kind': 'Loại',
  'field.order': 'Thứ tự tính từ Mặt Trời',
  'field.diameter': 'Đường kính',
  'field.mass': 'Khối lượng (Trái Đất = 1)',
  'field.distance': 'Khoảng cách trung bình tới Mặt Trời',
  'field.orbitalPeriod': 'Chu kỳ quỹ đạo',
  'field.rotationPeriod': 'Chu kỳ tự quay',
  'field.meanTemp': 'Nhiệt độ trung bình',
  'field.moons': 'Số vệ tinh đã biết',
  'field.gravity': 'Trọng lực bề mặt',

  'field.distanceEarth': 'Khoảng cách trung bình tới Trái Đất',
  'unit.km': 'km',
  'unit.millionKm': 'triệu km',
  'unit.days': 'ngày',
  'unit.years': 'năm',
  'unit.hours': 'giờ',
  'unit.earthMass': '× Trái Đất',
  'unit.retrograde': '(quay ngược)',
  'panel.order': '{kind} thứ {n}',
  'panel.facts': 'Điều thú vị',

  'kind.star': 'Ngôi sao',
  'kind.terrestrial': 'Hành tinh đất đá',
  'kind.gas-giant': 'Hành tinh khí khổng lồ',
  'kind.ice-giant': 'Hành tinh băng khổng lồ',
  'kind.dwarf-planet': 'Hành tinh lùn',
  'kind.moon': 'Vệ tinh',

  'lang.switch': 'Đổi ngôn ngữ',
};

export const UI_STRINGS: Record<Lang, Record<UiKey, string>> = {
  vi: VI,
  en: EN,
};
