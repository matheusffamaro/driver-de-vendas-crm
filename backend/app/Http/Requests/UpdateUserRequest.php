<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateUserRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => 'sometimes|string|max:255',
            'email' => 'sometimes|email|max:255|unique:users,email,' . $this->route('id'),
            'password' => 'sometimes|string|min:8',
            'role_id' => 'sometimes|uuid|exists:roles,id',
            'avatar' => 'sometimes|string|max:500',
            'phone' => 'sometimes|string|max:20',
            'signature' => 'sometimes|string|max:1000',
        ];
    }

    /**
     * Get validated data, excluding protected fields.
     */
    public function validatedSafe(): array
    {
        $data = $this->validated();
        
        // Remove any protected fields that might have been injected
        unset($data['is_super_admin']);
        unset($data['tenant_id']);
        unset($data['is_active']);
        unset($data['suspended_at']);
        unset($data['suspended_reason']);
        
        return $data;
    }
}
