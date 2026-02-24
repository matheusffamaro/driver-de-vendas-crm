<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Conta Suspensa - Driver de Vendas CRM</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            background: white;
            border-radius: 12px;
            padding: 40px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .logo {
            text-align: center;
            margin-bottom: 30px;
        }
        .logo-icon {
            width: 60px;
            height: 60px;
            background: linear-gradient(135deg, #EF4444 0%, #DC2626 100%);
            border-radius: 16px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 10px;
        }
        .logo-icon svg {
            width: 32px;
            height: 32px;
            color: white;
        }
        .logo-text {
            font-size: 24px;
            font-weight: bold;
            color: #1f2937;
        }
        .alert {
            background: #fef2f2;
            border-left: 4px solid #EF4444;
            padding: 20px;
            border-radius: 0 8px 8px 0;
            margin: 24px 0;
        }
        .alert h2 {
            color: #DC2626;
            margin: 0 0 12px 0;
            font-size: 20px;
        }
        .alert p {
            margin: 8px 0;
            color: #991B1B;
        }
        h1 {
            color: #1f2937;
            font-size: 24px;
            margin-bottom: 20px;
            text-align: center;
        }
        p {
            color: #4b5563;
            margin-bottom: 16px;
        }
        .info-box {
            background: #f9fafb;
            border: 1px solid #e5e7eb;
            padding: 20px;
            border-radius: 8px;
            margin: 24px 0;
        }
        .info-box strong {
            color: #1f2937;
            display: block;
            margin-bottom: 8px;
        }
        .reason-box {
            background: #fffbeb;
            border-left: 4px solid #F59E0B;
            padding: 16px;
            border-radius: 0 8px 8px 0;
            margin: 20px 0;
        }
        .reason-box p {
            margin: 0;
            color: #92400e;
        }
        .contact-box {
            background: #f0f9ff;
            border: 2px solid #3B82F6;
            padding: 20px;
            border-radius: 8px;
            margin: 24px 0;
            text-align: center;
        }
        .contact-box h3 {
            color: #1E40AF;
            margin: 0 0 12px 0;
            font-size: 18px;
        }
        .contact-box p {
            margin: 8px 0;
            color: #1E3A8A;
        }
        .contact-box a {
            color: #3B82F6;
            text-decoration: none;
            font-weight: 600;
        }
        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            text-align: center;
            color: #9ca3af;
            font-size: 14px;
        }
        .warning-icon {
            font-size: 48px;
            text-align: center;
            margin: 20px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">
            <div class="logo-icon">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
            </div>
            <div class="logo-text">Driver de Vendas CRM</div>
        </div>

        <div class="warning-icon">⚠️</div>

        <h1>Sua Conta foi Suspensa</h1>

        <p>Prezado(a) Administrador(a) da <strong>{{ $tenant->name }}</strong>,</p>

        <div class="alert">
            <h2>Conta Suspensa</h2>
            <p>Informamos que sua conta no Driver de Vendas CRM foi suspensa.</p>
            <p><strong>Data da Suspensão:</strong> {{ now()->format('d/m/Y às H:i') }}</p>
        </div>

        @if($reason)
        <div class="reason-box">
            <p><strong>Motivo:</strong> {{ $reason }}</p>
        </div>
        @endif

        <div class="info-box">
            <strong>O que isso significa?</strong>
            <p style="margin: 8px 0;">• Seu acesso ao sistema está temporariamente bloqueado</p>
            <p style="margin: 8px 0;">• Todos os usuários da sua empresa não conseguem fazer login</p>
            <p style="margin: 8px 0;">• Seus dados estão seguros e preservados</p>
            <p style="margin: 8px 0;">• Nenhuma informação será perdida durante a suspensão</p>
        </div>

        <div class="contact-box">
            <h3>📞 Como Reativar sua Conta?</h3>
            <p>Entre em contato com nosso suporte para resolver a situação:</p>
            <p style="margin-top: 16px;">
                <strong>E-mail:</strong> <a href="mailto:{{ $supportEmail }}">{{ $supportEmail }}</a><br>
                <strong>Telefone:</strong> {{ $supportPhone }}
            </p>
            <p style="margin-top: 16px; font-size: 14px; color: #6b7280;">
                Nossa equipe está pronta para ajudar você a reativar sua conta o mais rápido possível.
            </p>
        </div>

        <p style="margin-top: 30px;">Caso tenha dúvidas ou precise de esclarecimentos, não hesite em nos contatar.</p>

        <p style="margin-top: 24px;">
            Atenciosamente,<br>
            <strong>Equipe Driver de Vendas CRM</strong>
        </p>

        <div class="footer">
            <p>Este email foi enviado automaticamente pelo Driver de Vendas CRM.</p>
            <p>&copy; {{ date('Y') }} Driver de Vendas CRM. Todos os direitos reservados.</p>
        </div>
    </div>
</body>
</html>
