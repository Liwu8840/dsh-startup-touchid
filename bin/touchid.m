// macOS 设备所有者认证：指纹和密码均由系统面板处理，程序不读取凭据。
// --probe 仅检查系统认证可用性；--reason 指定系统面板的说明。
// stdout 仅输出认证结果及错误码；退出码为 0 通过、1 未通过、2 不可用、3 超时。

#import <Foundation/Foundation.h>
#import <LocalAuthentication/LocalAuthentication.h>

static void emit(NSDictionary *dict) {
    NSError *error = nil;
    NSData *data = [NSJSONSerialization dataWithJSONObject:dict options:0 error:&error];
    if (data) {
        NSString *line = [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
        printf("%s\n", line.UTF8String);
        fflush(stdout);   // stdout 是管道时 print 会缓冲，必须显式刷掉
    }
}

static NSString *biometryName(LABiometryType type) {
    switch (type) {
        case LABiometryTypeTouchID: return @"touchid";
        case LABiometryTypeFaceID:  return @"faceid";
        default:                    return @"none";
    }
}

/* ── main ───────────────────────────────────────────────────────────────── */

int main(int argc, const char *argv[]) {
    @autoreleasepool {
        NSString *reason = @"请使用 Touch ID 或 macOS 登录密码启动 DeepSeek Harness";
        BOOL probeOnly = NO;

        for (int i = 1; i < argc; i++) {
            NSString *arg = [NSString stringWithUTF8String:argv[i]];
            if ([arg isEqualToString:@"--reason"] && i + 1 < argc) {
                reason = [NSString stringWithUTF8String:argv[++i]];
            } else if ([arg isEqualToString:@"--probe"]) {
                probeOnly = YES;
            } else {
                emit(@{@"ok": @NO, @"reason": @"invalid-arguments", @"code": @-1});
                return 2;
            }
        }

        LAPolicy policy = LAPolicyDeviceOwnerAuthentication;

        LAContext *context = [[LAContext alloc] init];
        [context setLocalizedCancelTitle:@"取消"];
        [context setLocalizedFallbackTitle:@"使用 macOS 登录密码"];

        NSError *authError = nil;
        if (![context canEvaluatePolicy:policy error:&authError]) {
            emit(@{
                @"ok": @NO,
                @"reason": @"unavailable",
                @"code": @(authError ? authError.code : -1),
                @"biometry": biometryName(context.biometryType)
            });
            return 2;
        }

        if (probeOnly) {
            emit(@{
                @"ok": @YES,
                @"reason": @"available",
                @"code": @0,
                @"biometry": biometryName(context.biometryType)
            });
            return 0;
        }

        __block int exitCode = 1;
        dispatch_semaphore_t done = dispatch_semaphore_create(0);

        [context evaluatePolicy:policy localizedReason:reason reply:^(BOOL success, NSError *error) {
            if (success) {
                emit(@{
                    @"ok": @YES,
                    @"reason": @"granted",
                    @"code": @0,
                    @"biometry": biometryName(context.biometryType)
                });
                exitCode = 0;
            } else {
                emit(@{
                    @"ok": @NO,
                    @"reason": error.code == LAErrorUserCancel ? @"cancelled" : @"denied",
                    @"code": @(error ? error.code : -1),
                    @"biometry": biometryName(context.biometryType)
                });
                exitCode = 1;
            }
            dispatch_semaphore_signal(done);
        }];

        // 60 秒上限：用户既不按指纹也不取消时不能把 host 挂死
        if (dispatch_semaphore_wait(done, dispatch_time(DISPATCH_TIME_NOW, 60 * NSEC_PER_SEC)) != 0) {
            [context invalidate];
            emit(@{@"ok": @NO, @"reason": @"timeout", @"code": @-1, @"biometry": @"none"});
            return 3;
        }

        return exitCode;
    }
}
