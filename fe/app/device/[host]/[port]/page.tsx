'use client';

import { useState, useEffect } from 'react';
import { Container, Title, Text, Button, Card, Stack, Group, TextInput, Loader, Center, Alert, Badge, ActionIcon, Modal, Code, PasswordInput, NumberInput, Checkbox, Textarea } from '@mantine/core';
import { IconArrowLeft, IconAlertCircle, IconChevronRight, IconCheck, IconKey, IconPlus } from '@tabler/icons-react';
import Link from 'next/link';
import { use } from 'react';
import { db } from '@/lib/db';
import { AddToRemoteModal } from '@/app/components/AddToRemoteModal';

interface FunctionInput {
  name: string;
  type: string;
  description?: string;
  required?: boolean;
}

interface DeviceFunction {
  id: string;
  name: string;
  description: string;
  inputs: FunctionInput[];
}

interface FunctionsResponse {
  functions: DeviceFunction[];
  count: number;
}

export default function DevicePage({ params }: { params: Promise<{ host: string; port: string }> }) {
  const { host, port } = use(params);
  const [functions, setFunctions] = useState<DeviceFunction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFunction, setSelectedFunction] = useState<DeviceFunction | null>(null);
  const [inputValues, setInputValues] = useState<Record<string, any>>({});
  const [calling, setCalling] = useState(false);
  const [callResult, setCallResult] = useState<any>(null);
  const [showResultModal, setShowResultModal] = useState(false);

  // API Key management
  const [apiKey, setApiKey] = useState<string>('');
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [savingApiKey, setSavingApiKey] = useState(false);

  // Add to Remote modal
  const [showAddToRemoteModal, setShowAddToRemoteModal] = useState(false);
  const [selectedFunctionForRemote, setSelectedFunctionForRemote] = useState<DeviceFunction | null>(null);

  useEffect(() => {
    loadApiKey();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host, port]);

  const loadApiKey = async () => {
    try {
      const hostPort = `${host}:${port}`;
      const device = await db.devices.where('hostPort').equals(hostPort).first();

      if (device?.apiKey) {
        setApiKey(device.apiKey);
        loadFunctions(device.apiKey);
      } else {
        // No API key saved, show modal
        setShowApiKeyModal(true);
        setLoading(false);
      }
    } catch (err) {
      console.error('Error loading API key:', err);
      setShowApiKeyModal(true);
      setLoading(false);
    }
  };

  const handleSaveApiKey = async () => {
    if (!apiKeyInput.trim()) {
      setError('API key is required');
      return;
    }

    setSavingApiKey(true);
    setError(null);

    try {
      // Test the API key by trying to load functions
      const response = await fetch(`/api/device/${host}/${port}/functions`, {
        headers: {
          'X-API-Key': apiKeyInput,
        },
      });

      if (response.status === 401) {
        setError('Invalid API key');
        setSavingApiKey(false);
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to validate API key');
      }

      // API key is valid, save it
      const hostPort = `${host}:${port}`;
      const device = await db.devices.where('hostPort').equals(hostPort).first();

      if (device) {
        await db.devices.update(device.id!, { apiKey: apiKeyInput });
      } else {
        // Create a new device entry with the API key
        await db.devices.add({
          hostPort,
          host,
          port: parseInt(port),
          name: `Device at ${host}:${port}`,
          description: '',
          version: '1.0.0',
          lastSeen: new Date().toISOString(),
          discovered: new Date().toISOString(),
          apiKey: apiKeyInput,
        });
      }

      setApiKey(apiKeyInput);
      setShowApiKeyModal(false);
      setApiKeyInput('');

      // Load functions with the new API key
      const data: FunctionsResponse = await response.json();
      setFunctions(data.functions || []);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save API key');
    } finally {
      setSavingApiKey(false);
    }
  };

  const loadFunctions = async (key: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/device/${host}/${port}/functions`, {
        headers: {
          'X-API-Key': key,
        },
      });

      if (response.status === 401) {
        setError('Invalid API key. Please update your API key.');
        setShowApiKeyModal(true);
        setLoading(false);
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to load functions');
      }

      const data: FunctionsResponse = await response.json();
      setFunctions(data.functions || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load device functions');
      console.error('Load functions error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFunctionClick = (func: DeviceFunction) => {
    setSelectedFunction(func);
    setInputValues({});
    setCallResult(null);
  };

  const handleCallFunction = async () => {
    if (!selectedFunction) return;

    setCalling(true);
    setCallResult(null);
    setError(null);

    try {
      // Convert input values to the expected format
      const inputs: Record<string, any> = {};
      selectedFunction.inputs.forEach(input => {
        const value = inputValues[input.name];
        const inputType = input.type.toLowerCase();

        // Skip undefined/empty values for non-boolean types
        if (inputType !== 'boolean' && inputType !== 'bool' && (value === undefined || value === '')) {
          return;
        }

        // Boolean values are already correct type from checkbox
        if (inputType === 'boolean' || inputType === 'bool') {
          inputs[input.name] = value === true;
        }
        // Number values are already correct type from NumberInput
        else if (inputType === 'number' || inputType === 'int' || inputType === 'integer' || inputType === 'float') {
          inputs[input.name] = value;
        }
        // JSON/Object/Array - parse the string
        else if (inputType === 'json' || inputType === 'object' || inputType === 'array') {
          try {
            inputs[input.name] = JSON.parse(value);
          } catch (e) {
            // If parsing fails, send as string and let backend handle it
            inputs[input.name] = value;
          }
        }
        // String and other types - use as-is
        else {
          inputs[input.name] = value;
        }
      });

      const response = await fetch(`/api/device/${host}/${port}/call`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
        },
        body: JSON.stringify({
          functionId: selectedFunction.id,
          inputs,
        }),
      });

      if (response.status === 401) {
        setError('Invalid API key. Please update your API key.');
        setShowApiKeyModal(true);
        setCalling(false);
        return;
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to call function');
      }

      const result = await response.json();
      setCallResult(result);
      setShowResultModal(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to call function');
      console.error('Call function error:', err);
    } finally {
      setCalling(false);
    }
  };

  const handleInputChange = (inputName: string, value: any) => {
    setInputValues(prev => ({
      ...prev,
      [inputName]: value,
    }));
  };

  const renderInputField = (input: FunctionInput) => {
    const inputType = input.type.toLowerCase();
    const value = inputValues[input.name];

    // Boolean/checkbox input
    if (inputType === 'boolean' || inputType === 'bool') {
      return (
        <Checkbox
          key={input.name}
          label={input.name}
          description={input.description}
          checked={value === true}
          onChange={(e) => handleInputChange(input.name, e.currentTarget.checked)}
        />
      );
    }

    // Number input
    if (inputType === 'number' || inputType === 'int' || inputType === 'integer' || inputType === 'float') {
      return (
        <NumberInput
          key={input.name}
          label={input.name}
          description={input.description}
          placeholder={`Enter ${input.type}${input.required ? ' (required)' : ''}`}
          required={input.required}
          value={value === undefined || value === '' ? undefined : Number(value)}
          onChange={(val) => handleInputChange(input.name, val)}
          allowDecimal={inputType === 'float' || inputType === 'number'}
          decimalScale={inputType === 'float' || inputType === 'number' ? 2 : 0}
        />
      );
    }

    // JSON/Object/Array - use textarea
    if (inputType === 'json' || inputType === 'object' || inputType === 'array') {
      return (
        <Textarea
          key={input.name}
          label={input.name}
          description={input.description || 'Enter valid JSON'}
          placeholder={`{"key": "value"}${input.required ? ' (required)' : ''}`}
          required={input.required}
          value={value || ''}
          onChange={(e) => handleInputChange(input.name, e.currentTarget.value)}
          minRows={3}
          autosize
        />
      );
    }

    // Default: text input for strings and other types
    return (
      <TextInput
        key={input.name}
        label={input.name}
        description={input.description}
        placeholder={`Enter ${input.type}${input.required ? ' (required)' : ''}`}
        required={input.required}
        value={value || ''}
        onChange={(e) => handleInputChange(input.name, e.currentTarget.value)}
      />
    );
  };

  if (loading) {
    return (
      <Container size="md" py="xl">
        <Center py="xl">
          <Stack align="center" gap="md">
            <Loader size="lg" />
            <Text c="dimmed">Loading device functions...</Text>
          </Stack>
        </Center>
      </Container>
    );
  }

  return (
    <Container size="md" py="xl">
      <Stack gap="lg">
        <Group>
          <ActionIcon
            component={Link}
            href="/"
            variant="subtle"
            size="lg"
          >
            <IconArrowLeft size={20} />
          </ActionIcon>
          <div style={{ flex: 1 }}>
            <Title order={2}>Device Control</Title>
            <Text size="sm" c="dimmed">{host}:{port}</Text>
          </div>
          <ActionIcon
            variant="light"
            size="lg"
            onClick={() => {
              setApiKeyInput(apiKey);
              setShowApiKeyModal(true);
            }}
            title="Update API Key"
          >
            <IconKey size={20} />
          </ActionIcon>
        </Group>

        {error && (
          <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red" onClose={() => setError(null)} withCloseButton>
            {error}
          </Alert>
        )}

        {selectedFunction ? (
          <Card withBorder p="lg">
            <Stack gap="md">
              <Group justify="space-between">
                <div>
                  <Text fw={600} size="lg">{selectedFunction.name}</Text>
                  {selectedFunction.description && (
                    <Text size="sm" c="dimmed">{selectedFunction.description}</Text>
                  )}
                </div>
                <Button
                  variant="subtle"
                  onClick={() => setSelectedFunction(null)}
                  size="xs"
                >
                  Cancel
                </Button>
              </Group>

              {selectedFunction.inputs.length > 0 ? (
                <Stack gap="sm">
                  <Text size="sm" fw={500}>Parameters:</Text>
                  {selectedFunction.inputs.map(input => renderInputField(input))}
                </Stack>
              ) : (
                <Text size="sm" c="dimmed">This function requires no parameters</Text>
              )}

              <Button
                onClick={handleCallFunction}
                loading={calling}
                disabled={calling}
                size="lg"
                fullWidth
              >
                {calling ? 'Calling...' : 'Execute Function'}
              </Button>
            </Stack>
          </Card>
        ) : (
          <>
            <div>
              <Text size="sm" c="dimmed">
                {functions.length} {functions.length === 1 ? 'function' : 'functions'} available
              </Text>
            </div>

            {functions.length === 0 ? (
              <Card withBorder p="xl">
                <Center>
                  <Text c="dimmed">No functions available on this device</Text>
                </Center>
              </Card>
            ) : (
              <Stack gap="sm">
                {functions.map(func => (
                  <Card
                    key={func.id}
                    withBorder
                    padding="md"
                    style={{ cursor: 'default' }}
                  >
                    <Group justify="space-between" wrap="nowrap">
                      <div
                        style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}
                        onClick={() => handleFunctionClick(func)}
                      >
                        <Group gap="xs">
                          <Text fw={500}>{func.name}</Text>
                          {func.inputs.length > 0 && (
                            <Badge size="xs" variant="light">
                              {func.inputs.length} {func.inputs.length === 1 ? 'param' : 'params'}
                            </Badge>
                          )}
                        </Group>
                        {func.description && (
                          <Text size="sm" c="dimmed" lineClamp={1}>
                            {func.description}
                          </Text>
                        )}
                      </div>
                      <Group gap="xs">
                        <ActionIcon
                          variant="light"
                          color="blue"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedFunctionForRemote(func);
                            setShowAddToRemoteModal(true);
                          }}
                        >
                          <IconPlus size={18} />
                        </ActionIcon>
                        <IconChevronRight size={20} opacity={0.5} style={{ cursor: 'pointer' }} onClick={() => handleFunctionClick(func)} />
                      </Group>
                    </Group>
                  </Card>
                ))}
              </Stack>
            )}
          </>
        )}
      </Stack>

      {/* API Key Modal */}
      <Modal
        opened={showApiKeyModal}
        onClose={() => !savingApiKey && setShowApiKeyModal(false)}
        title={<Group gap="xs"><IconKey size={20} /><Text fw={600}>Enter API Key</Text></Group>}
        closeOnClickOutside={false}
        closeOnEscape={false}
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            This device requires an API key for authentication. Please enter the API key to continue.
          </Text>
          <PasswordInput
            label="API Key"
            placeholder="Enter your API key"
            value={apiKeyInput}
            onChange={(e) => setApiKeyInput(e.currentTarget.value)}
            required
            disabled={savingApiKey}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !savingApiKey) {
                handleSaveApiKey();
              }
            }}
          />
          <Button
            onClick={handleSaveApiKey}
            loading={savingApiKey}
            disabled={savingApiKey || !apiKeyInput.trim()}
            fullWidth
          >
            {savingApiKey ? 'Validating...' : 'Save API Key'}
          </Button>
        </Stack>
      </Modal>

      {/* Result Modal */}
      <Modal
        opened={showResultModal}
        onClose={() => setShowResultModal(false)}
        title={<Group gap="xs"><IconCheck size={20} color="green" /><Text fw={600}>Function Result</Text></Group>}
        size="lg"
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            Function executed successfully
          </Text>
          <Code block style={{ maxHeight: '400px', overflow: 'auto' }}>
            {JSON.stringify(callResult, null, 2)}
          </Code>
          <Button onClick={() => setShowResultModal(false)} fullWidth>
            Close
          </Button>
        </Stack>
      </Modal>

      {/* Add to Remote Modal */}
      {selectedFunctionForRemote && (
        <AddToRemoteModal
          opened={showAddToRemoteModal}
          onClose={() => {
            setShowAddToRemoteModal(false);
            setSelectedFunctionForRemote(null);
          }}
          deviceHost={host}
          devicePort={parseInt(port)}
          functionId={selectedFunctionForRemote.id}
          functionName={selectedFunctionForRemote.name}
        />
      )}
    </Container>
  );
}
