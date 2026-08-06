import { useState, useEffect, useCallback } from 'react';
import { Segmented, Select } from 'antd';
import { getVisibilityOptions } from '../../utils/visibility';
import type { Visibility } from '../../utils/visibility';
import { listUsers } from '../../api/users';
import { useTagContext } from '../../contexts/TagContext';
import type { User } from '../../types/user';
import styles from './VisibilitySetting.module.css';

export type { Visibility };

interface VisibilitySettingProps {
  label?: string;
  value?: Visibility;
  restrictedUsers?: string[];
  restrictedTags?: string[];
  onChange?: (visibility: Visibility) => void;
  onRestrictedUsersChange?: (users: string[]) => void;
  onRestrictedTagsChange?: (tags: string[]) => void;
  hideRestricted?: boolean;
  showRestrictedTags?: boolean;
}

export default function VisibilitySetting({
  label = '可见性',
  value = 'public',
  restrictedUsers = [],
  restrictedTags = [],
  onChange,
  onRestrictedUsersChange,
  onRestrictedTagsChange,
  hideRestricted = false,
  showRestrictedTags = true,
}: VisibilitySettingProps) {
  const allOptions = getVisibilityOptions();
  const options = hideRestricted ? allOptions.filter((o) => o.value !== 'restricted') : allOptions;
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

  const segmentedOptions = options.map((opt) => ({
    label: opt.label,
    value: opt.value,
  }));

  return (
    <div className={styles.container ?? ''}>
      {label ? <div className={styles.label}>{label}</div> : null}
      <Segmented
        block
        options={segmentedOptions}
        value={value}
        onChange={(val) => onChange?.(val as Visibility)}
      />

      {value === 'restricted' && (
        <div className={styles.restrictedSection ?? ''}>
          <div>
            <p className={styles.sectionLabel ?? ''}>指定用户</p>
            <Select
              className={styles.userSelect ?? ''}
              mode="multiple"
              placeholder="选择可访问的用户"
              value={restrictedUsers}
              onChange={(v) => onRestrictedUsersChange?.(v)}
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

            {showRestrictedTags && (
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
            )}
        </div>
      )}
    </div>
  );
}
