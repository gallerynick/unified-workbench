import { useState, useEffect, useCallback } from 'react';
import { Radio, Select } from 'antd';
import type { RadioChangeEvent } from 'antd';
import { getVisibilityOptions } from '../../utils/visibility';
import type { Visibility } from '../../utils/visibility';
import { listUsers } from '../../api/users';
import { useTagContext } from '../../contexts/TagContext';
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
  const { tags } = useTagContext();
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
              <Select
                className={styles.userSelect ?? ''}
                mode="multiple"
                placeholder="选择可访问的标签"
                value={restrictedTags}
                onChange={(v) => onRestrictedTagsChange?.(v)}
                allowClear
                options={tags.map((t) => ({
                  value: t.id,
                  label: t.name,
                }))}
              />
            </div>
        </div>
      )}
    </div>
  );
}
