<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Convite - Driver de Vendas CRM</title>
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
            background: linear-gradient(135deg, #10B981 0%, #059669 100%);
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
        .highlight {
            background: #f0fdf4;
            border-left: 4px solid #10B981;
            padding: 16px;
            border-radius: 0 8px 8px 0;
            margin: 24px 0;
        }
        .highlight strong {
            color: #059669;
        }
        .button {
            display: inline-block;
            background: linear-gradient(135deg, #10B981 0%, #059669 100%);
            color: white !important;
            text-decoration: none;
            padding: 14px 32px;
            border-radius: 8px;
            font-weight: 600;
            font-size: 16px;
            margin: 24px 0;
            text-align: center;
        }
        .button:hover {
            background: linear-gradient(135deg, #059669 0%, #047857 100%);
        }
        .button-container {
            text-align: center;
        }
        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            text-align: center;
            color: #9ca3af;
            font-size: 14px;
        }
        .link {
            color: #10B981;
            word-break: break-all;
        }
        .expires {
            background: #fef3c7;
            color: #92400e;
            padding: 12px;
            border-radius: 8px;
            font-size: 14px;
            text-align: center;
            margin-top: 20px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">
            <div class="logo-icon">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                </svg>
            </div>
            <div class="logo-text">Driver de Vendas CRM</div>
        </div>

        <h1>Você foi convidado! 🎉</h1>

        <p>Olá{{ $invitation->name ? ', ' . $invitation->name : '' }}!</p>

        <p><strong>{{ $inviterName }}</strong> convidou você para fazer parte da equipe no <strong>Driver de Vendas CRM</strong>.</p>

        <div class="highlight">
            <p style="margin: 0;"><strong>Cargo:</strong> {{ $roleName }}</p>
            <p style="margin: 8px 0 0 0;"><strong>E-mail:</strong> {{ $invitation->email }}</p>
        </div>

        <p>Clique no botão abaixo para aceitar o convite e criar sua conta:</p>

        <div class="button-container">
            <a href="{{ $inviteUrl }}" class="button">Aceitar Convite</a>
        </div>

        <p style="font-size: 14px; color: #6b7280;">Se o botão não funcionar, copie e cole este link no seu navegador:</p>
        <p><a href="{{ $inviteUrl }}" class="link">{{ $inviteUrl }}</a></p>

        <div class="expires">
            ⏰ Este convite expira em <strong>7 dias</strong>
        </div>

        <div class="footer">
            <p>Este email foi enviado automaticamente pelo Driver de Vendas CRM.</p>
            <p>Se você não esperava este convite, pode ignorar este email.</p>
            <p>&copy; {{ date('Y') }} Driver de Vendas CRM. Todos os direitos reservados.</p>
        </div>
    </div>
</body>
</html>
