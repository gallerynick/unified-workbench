import { useState, useEffect, useCallback } from 'react';
import { Radio, Select, Tag } from 'antd';
import type { RadioChangeEvent } from 'antd';
import { getVisibilityOptions } from '../../utils/visibility';
import type { Visibility } from '../../utils/visibility';
import { listUsers } from '../../api/users';
import type { User } from '../../types/user';
import styles from './VisibilitySetting.module.css';

export type { Visibility };

interface VisibilitySettingProps {
  value?: Visibility;
  restrictedUsers?: string[];
  restrictedTags?: string[];
  onChange?: (visibility: Visibility) => void;
  onRestrictedUsersChange?: (users: string[]) => void;
  onRestrictedTagsChange?: (tags: string[]) => void;
  showDescription?: boolean;
  layout?: 'horizontal' | 'vertical';
}

const PRESET_TAGS = [
  { id: 'tag-1', name: '标签一', color: 'blue' },
  { id: 'tag-2', name: '标签二', color: 'purple' },
  { id: 'tag-3', name: '标签三', color: 'green' },
  { id: 'tag-4', name: '标签四', color: 'gold' },
];

export default function VisibilitySetting({
  value = 'public',
  restrictedUsers = [],
  restrictedTags = [],
  onChange,
  onRestrictedUsersChange,
  onRestrictedTagsChange,
  showDescription = false,
  layout = 'horizontal',
}: VisibilitySettingProps) {
  const options = getVisibilityOptions();
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const res = await listUsers({ page: 1, page_size: 100 });
      if (res.code === 0) {
        setUsers(res.data.items);
      }
    } catch {
      // 静默失败
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  useEffect(() => {
    if (value === 'restricted') {
      fetchUsers();
    }
  }, [value, fetchUsers]);

  const handleVisibilityChange = (e: RadioChangeEvent) => {
    onChange?.(e.target.value as Visibility);
  };

  const handleUserChange = (selectedUsers: string[]) => {
    onRestrictedUsersChange?.(selectedUsers);
  };

  const handleTagToggle = (tagId: string) => {
    const newTags = restrictedTags.includes(tagId)
      ? restrictedTags.filter((t) => t !== tagId)
      : [...restrictedTags, tagId];
    onRestrictedTagsChange?.(newTags);
  };

  return (
    <div className={styles.container ?? ''}>
      <Radio.Group
        className={styles.radioGroup ?? ''}
        value={value}
        onChange={handleVisibilityChange}
      >
        {layout === 'vertical' ? (
          <div className={styles.visibilitySection ?? ''}>
            {options.map((opt) => (
              <Radio key={opt.value} value={opt.value}>
                <div>
                  <div className={styles.visibilityOptionTitle ?? ''}>{opt.label}</div>
                  {showDescription && opt.description && (
                    <div className={styles.visibilityOptionDesc ?? ''}>{opt.description}</div>
                  )}
                </div>
              </Radio>
            ))}
          </div>
        ) : (
          options.map((opt) => (
            <Radio.Button key={opt.value} value={opt.value}>
              {opt.label}
            </Radio.Button>
          ))
        )}
      </Radio.Group>

      {value === 'restricted' && (
        <div className={styles.restrictedSection ?? ''}>
          <div>
            <p className={styles.sectionLabel ?? ''}>指定用户</p>
            <Select
              className={styles.userSelect ?? ''}
              mode="multiple"
              placeholder="选择可访问的用户"
              value={restrictedUsers}
              onChange={handleUserChange}
              loading={loadingUsers}
              allowClear
              showSearch
              optionFilterProp="label"
              options={users.map((u) => ({
                value: u.id,
                label: u.nickname || u.username,
              }))}
            />
          </div>

          <div>
            <p className={styles.sectionLabel ?? ''}>指定标签</p>
            <div className={styles.tagGroup ?? ''}>
              {PRESET_TAGS.map((tag) => (
                <Tag.CheckableTag
                  key={tag.id}
                  checked={restrictedTags.includes(tag.id)}
                  onChange={() => handleTagToggle(tag.id)}
                >
                  {tag.name}
                </Tag.CheckableTag>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
