import { useState, useEffect } from 'react';
import { Save, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import { Button, Card, Form, Input, InputNumber, Select, Radio, Divider, message, Spin } from 'antd';
import { getThirdPartyConfig, updateThirdPartyConfig, testAIConnection, testASRService, reloadASRModel } from '../../api/third-party-config';
import type { ThirdPartyConfig } from '../../types/third-party-config';
import { UnifiedResponse } from '../../types/user';

export default function ThirdPartyConfigPage() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<{ ai: boolean; asr: boolean }>({ ai: false, asr: false });
  const [config, setConfig] = useState<ThirdPartyConfig | null>(null);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const res: UnifiedResponse<any> = await getThirdPartyConfig();
      if (res.code === 0 && res.data) {
        setConfig(res.data);
        form.setFieldsValue(res.data);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const res: UnifiedResponse<any> = await updateThirdPartyConfig(values);
      if (res.code === 0) {
        message.success('配置已保存');
        setConfig(res.data);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const handleTestAI = async () => {
    setTesting((prev) => ({ ...prev, ai: true }));
    try {
      const res: UnifiedResponse<any> = await testAIConnection();
      if (res.code === 0) {
        if (res.data?.success) {
          message.success(res.data.message);
        } else {
          message.error(res.data.message);
        }
      }
    } catch (error) {
      message.error('测试失败');
    } finally {
      setTesting((prev) => ({ ...prev, ai: false }));
    }
  };

  const handleTestASR = async () => {
    setTesting((prev) => ({ ...prev, asr: true }));
    try {
      const res: UnifiedResponse<any> = await testASRService();
      if (res.code === 0) {
        if (res.data?.success) {
          message.success(res.data.message);
        } else {
          message.error(res.data.message);
        }
      }
    } catch (error) {
      message.error('测试失败');
    } finally {
      setTesting((prev) => ({ ...prev, asr: false }));
    }
  };

  const handleReloadASR = async () => {
    try {
      const res: UnifiedResponse<any> = await reloadASRModel();
      if (res.code === 0) {
        message.success(res.data?.message || '已重载');
      }
    } catch (error) {
      message.error('重载失败');
    }
  };

  if (loading || !config) {
    return (
      <div className="p-6 flex justify-center items-center h-full">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">第三方服务配置</h1>

      <Card title="AI 模型配置" className="mb-4">
        <Form form={form} layout="vertical">
          <Form.Item name={['ai_provider', 'mode']} label="模式">
            <Radio.Group>
              <Radio value="local">本地</Radio>
              <Radio value="online">在线</Radio>
            </Radio.Group>
          </Form.Item>

          <Form.Item name={['ai_provider', 'local', 'base_url']} label="Base URL">
            <Input placeholder="http://ollama:11434/v1" />
          </Form.Item>

          <Form.Item name={['ai_provider', 'local', 'model']} label="模型名称">
            <Input placeholder="qwen3.5:4b" />
          </Form.Item>

          <Form.Item name={['ai_provider', 'online', 'base_url']} label="在线 Base URL">
            <Input placeholder="https://api.openai.com/v1" />
          </Form.Item>

          <Form.Item name={['ai_provider', 'online', 'model']} label="在线模型名称">
            <Input placeholder="gpt-4o" />
          </Form.Item>

          <Form.Item name={['ai_provider', 'online', 'api_key']} label="API Key">
            <Input.Password placeholder="sk-..." />
          </Form.Item>

          <Form.Item name={['ai_provider', 'parameters', 'temperature']} label="Temperature">
            <InputNumber min={0} max={2} step={0.1} />
          </Form.Item>

          <Form.Item name={['ai_provider', 'parameters', 'max_tokens']} label="Max Tokens">
            <InputNumber min={100} max={8000} step={100} />
          </Form.Item>

          <Button type="primary" onClick={handleTestAI} loading={testing.ai}>
            测试连接
          </Button>
        </Form>
      </Card>

      <Card title="语音识别配置" className="mb-4">
        <Form form={form} layout="vertical">
          <Form.Item name={['asr_config', 'mode']} label="模式">
            <Radio.Group>
              <Radio value="local">本地</Radio>
              <Radio value="online">在线</Radio>
            </Radio.Group>
          </Form.Item>

          <Form.Item name={['asr_config', 'local', 'model']} label="ASR 模型">
            <Input placeholder="paraformer-zh" />
          </Form.Item>

          <Form.Item name={['asr_config', 'local', 'punc_model']} label="标点模型">
            <Input placeholder="ct-punc" />
          </Form.Item>

          <Form.Item name={['asr_config', 'local', 'spk_model']} label="说话人模型">
            <Input placeholder="campplus" />
          </Form.Item>

          <Form.Item name={['asr_config', 'online', 'provider']} label="在线提供商">
            <Select>
              <Select.Option value="openai">OpenAI</Select.Option>
              <Select.Option value="aliyun">阿里云</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item name={['asr_config', 'online', 'model']} label="在线模型">
            <Input placeholder="whisper-1" />
          </Form.Item>

          <Form.Item name={['asr_config', 'online', 'api_key']} label="API Key">
            <Input.Password placeholder="sk-..." />
          </Form.Item>

          <Divider />

          <Form.Item name={['asr_config', 'parameters', 'sample_rate']} label="采样率">
            <InputNumber value={16000} disabled />
          </Form.Item>

          <Form.Item name={['asr_config', 'parameters', 'hpf_cutoff']} label="高通滤波截止频率">
            <InputNumber value={80} disabled />
          </Form.Item>

          <Form.Item name={['asr_config', 'parameters', 'noise_reduction']} label="降噪强度">
            <InputNumber min={0} max={1} step={0.1} />
          </Form.Item>

          <Form.Item name={['asr_config', 'parameters', 'vad_threshold']} label="VAD 阈值">
            <InputNumber min={0} max={0.1} step={0.001} />
          </Form.Item>

          <Form.Item name={['asr_config', 'parameters', 'silence_timeout']} label="静音超时 (秒)">
            <InputNumber min={0.5} max={10} step={0.1} />
          </Form.Item>

          <Space>
            <Button type="primary" onClick={handleTestASR} loading={testing.asr}>
              测试识别
            </Button>
            <Button icon={<RefreshCw />} onClick={handleReloadASR}>
              重载模型
            </Button>
          </Space>
        </Form>
      </Card>

      <div className="flex justify-end">
        <Button type="primary" icon={<Save />} onClick={handleSave} loading={saving}>
          保存配置
        </Button>
      </div>
    </div>
  );
}
