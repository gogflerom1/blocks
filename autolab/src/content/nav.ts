import type { IcoName } from '../ui/icons';

// Главное меню. id = хеш маршрута
export const MODULES: { id: string; title: string; sub: string; icon: IcoName }[] = [
  { id: 'engine', title: 'Двигатель', sub: '4 такта, бензин/дизель, турбо, ГРМ', icon: 'engine' },
  { id: 'gearbox', title: 'Коробка и привод', sub: 'МКПП, автомат, робот, DSG, вариатор', icon: 'gearbox' },
  { id: 'chassis', title: 'Подвеска и руль', sub: 'Кочка, амортизатор, рейка', icon: 'suspension' },
  { id: 'brakes', title: 'Тормоза', sub: 'Гидравлика, ABS, ESP, износ', icon: 'brakes' },
  { id: 'electrics', title: 'Электрика', sub: 'АКБ, стартер, генератор, реле', icon: 'electrics' },
  { id: 'hood', title: 'Под капотом', sub: 'Что здесь находится', icon: 'hood' },
  { id: 'fluids', title: 'Что куда лить', sub: 'Масло, антифриз, тормозуха', icon: 'fluids' },
  { id: 'service', title: 'ТО', sub: 'Что и когда менять', icon: 'service' },
  { id: 'diag', title: 'Диагностика', sub: 'Что случилось с машиной', icon: 'diag' },
  { id: 'dash', title: 'Приборка', sub: 'Какие лампы опасны', icon: 'dash' },
  { id: 'tires', title: 'Колёса и шины', sub: '205/55 R16, давление, протектор', icon: 'tire' },
  { id: 'learn', title: 'Новичок', sub: '6 уроков с тестами', icon: 'learn' },
  { id: 'free', title: 'Свободный режим', sub: 'Заводи, газуй, рули, смотри', icon: 'free' },
  { id: 'mycar', title: 'Моя машина', sub: 'Профиль конкретной модели', icon: 'car' },
];

export const MAIN_MENU = ['engine', 'gearbox', 'chassis', 'brakes', 'electrics', 'hood', 'service', 'diag', 'learn', 'free'];
