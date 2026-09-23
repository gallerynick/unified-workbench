import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Form,
  Input,
  InputNumber,
  Select,
  Radio,
  Checkbox,
  Button,
  Typography,
  Result,
  Spin,
  message,
  Descriptions,
  Tag,
} from 'antd';
import { getFormPublic, submitFormResponse, getMyResponse } from '../../api/forms';
import { HttpError } from '../../utils/request';
import type { FormField, FormMyResponse, FormPublic } from '../../types/form';
import styles from './FormFill.module.css';

const { Title, Paragraph, Text } = Typography;

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '（未填写）';
  if (Array.isArray(value)) return value.length > 0 ? value.join('，') : '（未填写）';
  if (typeof value === 'boolean') return value ? '是' : '否';
  return String(value);
}

export default function FormFill() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [formData, setFormData] = useState<FormPublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [needLogin, setNeedLogin] = useState(false);
  const [myResponse, setMyResponse] = useState<FormMyResponse | null>(null);
  const [antForm] = Form.useForm();

  const loadForm = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setNotFound(false);
    try {
      // skipAuthRedirect：表单未开启「允许未登录填写」时后端返回 401，
      // 这里不自动跳登录，改在页面内提示并拦截
      const res = await getFormPublic(id, true);
      if (!res.data) {
        setNotFound(true);
        return;
      }
      setFormData(res.data);
      // 每人仅限提交一次：已提交过的登录用户直接展示只读回显
      try {
        const mine = await getMyResponse(id);
        if (mine.code === 0 && mine.data) setMyResponse(mine.data);
      } catch {
        // 未登录或尚未提交：保持空表单态
      }
    } catch (error) {
      // 401 表示未登录且该表单未开启「允许未登录填写」，就地提示并拦截
      if (error instanceof HttpError && error.status === 401) {
        setNeedLogin(true);
      } else {
        setNotFound(true);
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadForm();
  }, [loadForm]);

  const handleSubmit = async (values: Record<string, unknown>): Promise<void> => {
    if (!id) return;
    setSubmitting(true);
    try {
      const res = await submitFormResponse(id, values);
      if (res.code === 0) {
        message.success('提交成功！');
        setMyResponse({
          id: 'local',
          data: values,
          created_at: new Date().toISOString(),
        });
      } else {
        message.error(res.msg || '提交失败');
      }
    } catch (error) {
      message.error(error instanceof Error && error.message ? error.message : '提交失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  const renderField = (field: FormField) => {
    const { key, type, label, required, options, placeholder } = field;
    const rules = required ? [{ required: true, message: '请填写' + label }] : [];

    switch (type) {
      case 'text':
        return (
          <Form.Item key={key} name={key} label={label} rules={rules}>
            <Input placeholder={placeholder || ('请输入' + label)} />
          </Form.Item>
        );
      case 'textarea':
        return (
          <Form.Item key={key} name={key} label={label} rules={rules}>
            <Input.TextArea rows={4} placeholder={placeholder || ('请输入' + label)} />
          </Form.Item>
        );
      case 'number':
        return (
          <Form.Item key={key} name={key} label={label} rules={rules}>
            <InputNumber
              style={{ width: '100%' }}
              placeholder={placeholder || ('请输入' + label)}
            />
          </Form.Item>
        );
      case 'select':
        return (
          <Form.Item key={key} name={key} label={label} rules={rules}>
            <Select placeholder={placeholder || ('请选择' + label)} allowClear>
              {(options ?? []).map((opt) => (
                <Select.Option key={opt} value={opt}>
                  {opt}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
        );
      case 'radio':
        return (
          <Form.Item key={key} name={key} label={label} rules={rules}>
            <Radio.Group>
              {(options ?? []).map((opt) => (
                <Radio key={opt} value={opt}>
                  {opt}
                </Radio>
              ))}
            </Radio.Group>
          </Form.Item>
        );
      case 'checkbox':
        return (
          <Form.Item key={key} name={key} label={label} rules={rules}>
            <Checkbox.Group options={options ?? []} />
          </Form.Item>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <Spin size="large" />
      </div>
    );
  }

  // 未登录且表单未开启「允许未登录填写」：就地提示并拦截，不展示表单
  if (needLogin) {
    return (
      <div className={styles.container}>
        <Result
          status="403"
          title="仅允许登录用户填写"
          subTitle="该表单未开启「允许未登录填写」，请先登录后再提交"
          extra={
            <Button type="primary" onClick={() => navigate('/login')}>
              去登录
            </Button>
          }
        />
      </div>
    );
  }

  if (notFound || !formData) {
    return (
      <div className={styles.container}>
        <Result
          status="404"
          title="表单不存在"
          subTitle="该表单可能已被删除、已关闭，或你没有填写权限"
        />
      </div>
    );
  }

  if (myResponse) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.header}>
            <Title level={3}>{formData.title}</Title>
            {formData.description ? (
              <Paragraph type="secondary">{formData.description}</Paragraph>
            ) : null}
          </div>
          <Result
            status="success"
            title="你已提交过该表单"
            subTitle="每人仅限提交一次，以下是你提交的内容"
          />
          <Descriptions
            column={1}
            bordered
            items={formData.fields.map((field) => ({
              key: field.key,
              label: field.label,
              children: formatValue(myResponse.data[field.key]),
            }))}
          />
          <div style={{ marginTop: 'var(--spacing-md)' }}>
            <Text type="secondary">提交时间：&#32;</Text>
            <Tag color="blue">
              {new Date(myResponse.created_at).toLocaleString('zh-CN')}
            </Tag>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <Title level={3}>{formData.title}</Title>
          {formData.description ? (
            <Paragraph type="secondary">{formData.description}</Paragraph>
          ) : null}
        </div>
        <Form form={antForm} layout="vertical" onFinish={(v) => void handleSubmit(v)} autoComplete="off">
          {formData.fields.map((field) => renderField(field))}
          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={submitting}
              size="large"
              block
            >
              {submitting ? '提交中...' : '提交'}
            </Button>
          </Form.Item>
        </Form>
      </div>
    </div>
  );
}
