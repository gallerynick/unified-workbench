import { Typography } from 'antd';
import { useCustomization } from '../hooks/useCustomization';
import StatsWidget from './home/widgets/StatsWidget';
import CalendarWidget from './home/widgets/CalendarWidget';
import AnnouncementsWidget from './home/widgets/AnnouncementsWidget';
import NotificationsWidget from './home/widgets/NotificationsWidget';
import TodosWidget from './home/widgets/TodosWidget';
import QuickLinksWidget from './home/widgets/QuickLinksWidget';
import styles from './home/Home.module.css';

const { Title, Paragraph } = Typography;

const WIDGETS = [
  StatsWidget,
  CalendarWidget,
  AnnouncementsWidget,
  NotificationsWidget,
  TodosWidget,
  QuickLinksWidget,
];

export default function Home() {
  const customization = useCustomization();

  return (
    <div className={styles.homeContainer}>
      <div className={styles.headerBar}>
        <div>
          <Title level={2}>欢迎使用{customization.app.name}</Title>
          <Paragraph>{customization.app.description}</Paragraph>
        </div>
      </div>

      <div className={styles.widgetGrid}>
        {WIDGETS.map((Component, i) => (
          <div key={i} className={styles.widgetWrapper}>
            <Component />
          </div>
        ))}
      </div>
    </div>
  );
}
