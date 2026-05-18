import type { Translation } from '../i18n/translations'
import type { PatientMessageKey } from '../types/i18n'
import type { TherapyRecommendation } from '../progressAnalytics'
import type { Language } from '../types/i18n'


export function translateStatus(status: string, t: Translation) {
  switch (status) {
    case 'подключение':
      return t.live.status.connecting
    case 'ожидание запуска':
      return t.live.status.launchWaiting
    case 'подключено':
      return t.live.status.connected
    case 'бэкенд недоступен':
      return t.live.status.backendUnavailable
    case 'ошибка сокета':
      return t.live.status.socketError
    case 'отключено':
      return t.live.status.disconnected
    default:
      return status
  }
}

export function patientMessageText(message: string, t: Translation) {
  return t.patient.messages[(message as PatientMessageKey) in t.patient.messages ? (message as PatientMessageKey) : 'waiting']
}

export function presetLabel(id: string, t: Translation) {
  switch (id) {
    case 'demo':
      return t.control.demo
    case 'easy':
      return t.control.easy
    case 'fast':
      return t.control.fast
    default:
      return id
  }
}

export function runtimeErrorText(error: string, t: Translation) {
  if (error === 'Не удалось выполнить действие') {
    return t.control.actionFailed
  }

  if (error === 'Backend runtime недоступен') {
    return t.control.backendUnavailable
  }

  return error
}

export function recommendationText(recommendation: TherapyRecommendation, language: Language) {
  const copy = {
    ru: {
      symmetry: {
        label: 'Обратная связь по симметрии',
        detail: 'Используйте подсказки от шага к шагу, чтобы снизить разницу времени опоры слева и справа.',
      },
      stability: {
        label: 'Баланс и контроль опоры',
        detail: 'Продолжайте медленные удержания стойки и контролируемые переносы веса перед повышением скорости.',
      },
      variability: {
        label: 'Стабильность ритма',
        detail: 'Держите скорость дорожки контролируемой и добавьте работу с каденсом для более ровных шагов.',
      },
      'load-balance': {
        label: 'Перераспределение подошвенной нагрузки',
        detail: 'Добавьте обратную связь для более мягкой нагрузки на стороне с повышенным давлением.',
      },
      progression: {
        label: 'Продолжать текущую прогрессию',
        detail: 'Балл походки заметно вырос от базового уровня; сохраняйте прогрессию с небольшим повышением сложности.',
      },
      'load-gain': {
        label: 'Улучшение баланса нагрузки',
        detail: 'Левая и правая нагрузки теперь близки; сохраняйте этот паттерн при увеличении скорости.',
      },
    },
    kk: {
      symmetry: {
        label: 'Симметрия бойынша кері байланыс',
        detail: 'Сол және оң тірек уақытының айырмасын азайту үшін әр қадамға арналған нұсқауларды қолданыңыз.',
      },
      stability: {
        label: 'Баланс және тірек бақылауы',
        detail: 'Жылдамдықты арттырмас бұрын баяу тұру ұсталымдарын және салмақты бақылап ауыстыруды жалғастырыңыз.',
      },
      variability: {
        label: 'Ырғақ тұрақтылығы',
        detail: 'Қадамдарды біркелкі ету үшін жолақ жылдамдығын бақылап, каденс ырғағымен жұмыс қосыңыз.',
      },
      'load-balance': {
        label: 'Табан жүктемесін қайта бөлу',
        detail: 'Қысымы жоғары жақта жүктемені жұмсарту үшін кері байланыс қосыңыз.',
      },
      progression: {
        label: 'Ағымдағы прогрессияны жалғастыру',
        detail: 'Жүріс балы бастапқы деңгейден айтарлықтай өсті; қиындықты аздап арттырып жалғастырыңыз.',
      },
      'load-gain': {
        label: 'Жүктеме балансы жақсарды',
        detail: 'Сол және оң жүктемелер жақындады; жылдамдық артқанда осы үлгіні сақтаңыз.',
      },
    },
  } as const

  if (language === 'en') {
    return { label: recommendation.label, detail: recommendation.detail }
  }

  return copy[language][recommendation.id as keyof (typeof copy)['ru']] ?? {
    label: recommendation.label,
    detail: recommendation.detail,
  }
}
