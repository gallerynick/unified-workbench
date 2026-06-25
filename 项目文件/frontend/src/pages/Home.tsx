import { useState, useEffect, useCallback } from 'react';
import { Typography, Button, Empty } from 'antd';
import { SettingOutlined } from '@ant-design/icons';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { useCustomization } from '../hooks/useCustomization';
import type { WidgetItem, WidgetLayout, WidgetType } from './home/types';
import { DEFAULT_WIDGET_LAYOUT } from './home/types';
import SortableWidget from './home/SortableWidget';
import WidgetSelectorModal from './home/WidgetSelectorModal';
import StatsWidget from './home/widgets/StatsWidget';
import CalendarWidget from './home/widgets/CalendarWidget';
import AnnouncementsWidget from './home/widgets/AnnouncementsWidget';
import NotificationsWidget from './home/widgets/NotificationsWidget';
import TodosWidget from './home/widgets/TodosWidget';
import QuickLinksWidget from './home/widgets/QuickLinksWidget';
import styles from './home/Home.module.css';

const { Title, Paragraph } = Typography;

const STORAGE_KEY = 'home-widget-layout';

const WIDGET_COMPONENTS: Record<WidgetType, React.ComponentType> = {
  stats: StatsWidget,
  calendar: CalendarWidget,
  announcements: AnnouncementsWidget,
  notifications: NotificationsWidget,
  todos: TodosWidget,
  quicklinks: QuickLinksWidget,
};

function loadLayout(): WidgetLayout {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as WidgetLayout;
      if (parsed.widgets && Array.isArray(parsed.widgets)) {
        const existing = new Map<string, boolean>(
          parsed.widgets.map((w: WidgetItem) => [w.id, w.visible])
        );
        const merged = DEFAULT_WIDGET_LAYOUT.widgets.map((w) => ({
          ...w,
          visible: existing.has(w.id) ? existing.get(w.id)! : w.visible,
        }));
        const orderedIds = parsed.widgets.map((w: WidgetItem) => w.id);
        const sorted = [
          ...merged
            .filter((w) => orderedIds.includes(w.id))
            .sort(
              (a, b) => orderedIds.indexOf(a.id) - orderedIds.indexOf(b.id)
            ),
          ...merged.filter((w) => !orderedIds.includes(w.id)),
        ];
        return { widgets: sorted };
      }
    }
  } catch {
    // ignore
  }
  return DEFAULT_WIDGET_LAYOUT;
}

function saveLayout(layout: WidgetLayout): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch {
    // ignore
  }
}

export default function Home() {
  const customization = useCustomization();
  const [widgets, setWidgets] = useState<WidgetItem[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const layout = loadLayout();
    setWidgets(layout.widgets);
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) {
      saveLayout({ widgets });
    }
  }, [widgets, loaded]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setWidgets((prev) => {
        const oldIndex = prev.findIndex((w) => w.id === active.id);
        const newIndex = prev.findIndex((w) => w.id === over.id);
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  }, []);

  const handleToggleWidget = useCallback((id: string, visible: boolean) => {
    setWidgets((prev) =>
      prev.map((w) => (w.id === id ? { ...w, visible } : w))
    );
  }, []);

  const visibleWidgets = widgets.filter((w) => w.visible);

  return (
    <div className={styles.homeContainer}>
      <div className={styles.headerBar}>
        <div>
          <Title level={2}>欢迎使用{customization.app.name}</Title>
          <Paragraph>{customization.app.description}</Paragraph>
        </div>
        <Button
          icon={<SettingOutlined />}
          onClick={() => setModalOpen(true)}
        >
          自定义布局
        </Button>
      </div>

      {visibleWidgets.length === 0 ? (
        <Empty description="暂无显示的组件，请点击“自定义布局”添加" />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={visibleWidgets.map((w) => w.id)}
            strategy={rectSortingStrategy}
          >
            <div className={styles.widgetGrid}>
              {visibleWidgets.map((widget) => {
                const Component = WIDGET_COMPONENTS[widget.id];
                if (!Component) return null;
                return (
                  <SortableWidget
                    key={widget.id}
                    id={widget.id}
                    onRemove={() => handleToggleWidget(widget.id, false)}
                  >
                    <Component />
                  </SortableWidget>
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <WidgetSelectorModal
        open={modalOpen}
        widgets={widgets}
        onClose={() => setModalOpen(false)}
        onToggle={handleToggleWidget}
      />
    </div>
  );
}
