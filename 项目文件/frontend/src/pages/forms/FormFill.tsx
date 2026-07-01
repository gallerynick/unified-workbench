import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
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
} from 'antd';
import { getFormPublic, submitFormResponse } from '../../api/forms';
import type { FormField } from '../../types/form';
import styles from './FormFill.module.css';

const { Title, Paragraph } = Typography;

interface FormPublicData {
  id: string;
  title: string;
  description: string;
  fields: FormField[];
  allow_anonymous: boolean;
}

export default function FormFill() {
  const { id } = useParams<{ id: string }>();
  const [formData, setFormData] = useState<FormPublicData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [requireLogin, setRequireLogin] = useState(false);
  const [antForm] = Form.useForm();

  const loadForm = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setNotFound(false);
    try {
      const res = await getFormPublic(id);
      if (res.code !== 0 || !res.data) {
        setNotFound(true);
        return;
      }
      setFormData(res.data);
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadForm();
  }, [loadForm]);

  const handleSubmit = async (values: Record<string, unknown>) => {
    if (!id) return;
    setSubmitting(true);
    try {
      const res = await submitFormResponse(id, values);
      if (res.code === 0) {
        setSubmitted(true);
        message.success('提交成功！');
      } else if (res.code === 403) {
        setRequireLogin(true);
      } else {
        message.error(res.msg || '提交失败');
      }
    } catch {
      message.error('提交失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  const renderField = (field: FormField) => {
    const { key, type, label, required, options, placeholder } = field;
    const rules = required ? [{ required: true, message: `请填写${label}` }] : [];

    switch (type) {
      case 'text':
        return (
          <Form.Item key={key} name={key} label={label} rules={rules}>
            <Input placeholder={placeholder || `请输入${label}`} />
          </Form.Item>
        );
      case 'textarea':
        return (
          <Form.Item key={key} name={key} label={label} rules={rules}>
            <Input.TextArea rows={4} placeholder={placeholder || `请输入${label}`} />
          </Form.Item>
        );
      case 'number':
        return (
          <Form.Item key={key} name={key} label={label} rules={rules}>
            <InputNumber style={{ width: '100%' }} placeholder={placeholder || `请输入${label}`} />
          </Form.Item>
        );
      case 'select':
        return (
          <Form.Item key={key} name={key} label={label} rules={rules}>
            <Select placeholder={placeholder || `请选择${label}`} allowClear>
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

  if (notFound || !formData) {
    return (
      <div className={styles.container}>
        <Result
          status="404"
          title="表单不存在"
          subTitle="该表单可能已被删除或链接无效"
        />
      </div>
    );
  }

  if (requireLogin) {
    return (
      <div className={styles.container}>
        <Result
          status="403"
          title="需要登录"
          subTitle="该表单需要登录后才能填写"
          extra={
            <Button type="primary" onClick={() => window.location.href = '/login'}>
              去登录
            </Button>
          }
        />
      </div>
    );
  }

  if (submitted) {
    return (
      <div className={styles.container}>
        <Result
          status="success"
          title="提交成功！"
          subTitle="感谢您的填写，您的回复已成功提交。"
          extra={
            <Button
              type="primary"
              onClick={() => {
                setSubmitted(false);
                antForm.resetFields();
              }}
            >
              再填一份
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <Title level={3}>{formData.title}</Title>
          {formData.description && (
            <Paragraph type="secondary">
              {formData.description}
            </Paragraph>
          )}
        </div>
        <Form
          form={antForm}
          layout="vertical"
          onFinish={handleSubmit}
          autoComplete="off"
        >
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
