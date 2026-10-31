// Системы автомобиля на главном экране: подписи, краткое объяснение, куда ведёт, где точка на 3D-модели.
export type SystemId =
  | 'body' | 'engine' | 'gearbox' | 'battery' | 'brakes' | 'suspension' | 'steering'
  | 'cooling' | 'exhaust' | 'fuel' | 'wheels' | 'cabin' | 'electrics' | 'fluids';

export type SystemInfo = {
  id: SystemId;
  title: string;
  color: string;
  lead: string;
  link: [string, string?];
  linkLabel: string;
  anchor: [number, number, number]; // точка в метрах: x вперёд, y вверх, z вправо
  normal: [number, number, number]; // куда «смотрит» метка (для скрытия за машиной)
  layer?: LayerId;
};

export type LayerId = 'body' | 'engine' | 'gearbox' | 'suspension' | 'brakes' | 'fuel' | 'exhaust' | 'cooling' | 'electrics' | 'cabin' | 'wheels' | 'steering';

export const LAYERS: { id: LayerId; title: string; color: string }[] = [
  { id: 'body', title: 'Кузов', color: '#3de2ff' },
  { id: 'engine', title: 'Двигатель', color: '#ff8a4c' },
  { id: 'gearbox', title: 'Трансмиссия', color: '#5aa8ff' },
  { id: 'suspension', title: 'Подвеска', color: '#8ef06a' },
  { id: 'brakes', title: 'Тормоза', color: '#ff4b5c' },
  { id: 'steering', title: 'Рулевое', color: '#c79bff' },
  { id: 'fuel', title: 'Топливная', color: '#ffb547' },
  { id: 'exhaust', title: 'Выхлоп', color: '#c9a48f' },
  { id: 'cooling', title: 'Охлаждение', color: '#4dd6c4' },
  { id: 'electrics', title: 'Электрика', color: '#ffe45c' },
  { id: 'cabin', title: 'Салон', color: '#9fb3d6' },
  { id: 'wheels', title: 'Колёса', color: '#d0dbec' },
];

export const SYSTEMS: SystemInfo[] = [
  { id: 'engine', title: 'Двигатель', color: '#ff8a4c', layer: 'engine', anchor: [1.42, 0.86, 0.05], normal: [0.3, 1, 0],
    lead: 'Превращает энергию топлива во вращение коленвала. Внутри — цилиндры, где 4 такта повторяются тысячи раз в минуту.',
    link: ['engine'], linkLabel: 'Как работает двигатель' },
  { id: 'gearbox', title: 'Коробка передач', color: '#5aa8ff', layer: 'gearbox', anchor: [1.36, 0.52, -0.58], normal: [0, 0.3, -1],
    lead: 'Меняет передаточное отношение между двигателем и колёсами: на 1-й — много силы, на 5-й — много скорости при низких оборотах.',
    link: ['gearbox'], linkLabel: 'Сравнить МКПП / АКПП / DSG / CVT' },
  { id: 'battery', title: 'Аккумулятор', color: '#ffe45c', layer: 'electrics', anchor: [1.6, 0.84, -0.6], normal: [0, 1, -0.4],
    lead: '12 В для запуска и питания при заглушенном моторе. Когда двигатель работает, всё питает генератор, а АКБ подзаряжается.',
    link: ['electrics'], linkLabel: 'Схема электрики' },
  { id: 'brakes', title: 'Тормоза', color: '#ff4b5c', layer: 'brakes', anchor: [1.3, 0.42, -0.62], normal: [0, 0, -1],
    lead: 'Педаль создаёт давление жидкости, суппорт сжимает колодками диск. Энергия движения превращается в тепло.',
    link: ['brakes'], linkLabel: 'Тормоза и ABS' },
  { id: 'suspension', title: 'Подвеска', color: '#8ef06a', layer: 'suspension', anchor: [-1.3, 0.62, 0.62], normal: [0, 0.3, 1],
    lead: 'Пружина держит вес и поглощает удар, амортизатор гасит раскачку. Рычаги задают, как колесо ходит вверх-вниз.',
    link: ['chassis'], linkLabel: 'Кочка в замедленной съёмке' },
  { id: 'steering', title: 'Рулевое управление', color: '#c79bff', layer: 'steering', anchor: [1.12, 0.45, 0.4], normal: [0.2, 0.3, 1],
    lead: 'Руль крутит вал, шестерня двигает рейку, тяги поворачивают колёса. Усилитель помогает гидравликой или электромотором.',
    link: ['chassis', 'steering'], linkLabel: 'Покрутить руль' },
  { id: 'cooling', title: 'Радиатор и охлаждение', color: '#4dd6c4', layer: 'cooling', anchor: [1.98, 0.55, 0.3], normal: [1, 0.2, 0],
    lead: 'Антифриз забирает лишнее тепло из двигателя и отдаёт его воздуху в радиаторе. Термостат держит рабочую температуру.',
    link: ['engine', 'cooling'], linkLabel: 'Путь антифриза' },
  { id: 'exhaust', title: 'Выхлоп', color: '#c9a48f', layer: 'exhaust', anchor: [-0.2, 0.18, 0.15], normal: [0, -0.3, 1],
    lead: 'Отводит газы из цилиндров: коллектор → катализатор (дожигает вредные вещества) → глушители → труба.',
    link: ['engine'], linkLabel: 'Такт выпуска в анимации' },
  { id: 'fuel', title: 'Топливная система', color: '#ffb547', layer: 'fuel', anchor: [-0.9, 0.42, -0.4], normal: [0, 0.4, -1],
    lead: 'Бак → насос в баке → фильтр → топливная рампа → форсунки. Форсунки впрыскивают точную порцию топлива по команде ЭБУ.',
    link: ['engine', 'fuel'], linkLabel: 'Бензин против дизеля' },
  { id: 'wheels', title: 'Колёса и шины', color: '#d0dbec', layer: 'wheels', anchor: [-1.3, 0.32, -0.88], normal: [0, 0, -1],
    lead: 'Единственное, что касается дороги: четыре пятна размером с ладонь. От давления и протектора зависит торможение.',
    link: ['tires'], linkLabel: 'Расшифровать маркировку' },
  { id: 'cabin', title: 'Салон и приборка', color: '#9fb3d6', layer: 'cabin', anchor: [0.2, 1.05, -0.38], normal: [0, 1, -0.3],
    lead: 'Отсюда управляют всем: педали, руль, селектор. Приборная панель сообщает о неисправностях лампами трёх цветов.',
    link: ['dash'], linkLabel: 'Что значат лампы' },
  { id: 'electrics', title: 'Электроника', color: '#ffe45c', layer: 'electrics', anchor: [1.22, 0.82, -0.6], normal: [0, 1, -0.3],
    lead: 'Блок предохранителей, реле, ЭБУ и десятки датчиков. Минус АКБ соединён с кузовом — это «масса».',
    link: ['electrics'], linkLabel: 'Ток от АКБ к стартеру' },
  { id: 'fluids', title: 'Жидкости', color: '#3fb4ff', anchor: [1.0, 0.95, 0.35], normal: [0.2, 1, 0.3],
    lead: 'Масло, антифриз, тормозная жидкость, омывайка. Каждая — в свой бачок со своим значком на крышке.',
    link: ['fluids'], linkLabel: 'Что куда лить' },
];
